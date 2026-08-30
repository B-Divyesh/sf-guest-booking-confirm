mod auth;

use std::{net::SocketAddr, path::Path, str::FromStr, time::Duration};

use anyhow::Context;
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, Path as AxumPath, Query, Request, State},
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, patch, post},
    Json, Router,
};
use chrono::{
    DateTime, Datelike, Duration as ChronoDuration, LocalResult, NaiveDate, TimeZone, Utc,
};
use chrono_tz::Tz;
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    FromRow, SqlitePool,
};
use tokio::{net::TcpListener, signal};
use tower::ServiceExt;
use tower_http::{limit::RequestBodyLimitLayer, services::ServeDir, trace::TraceLayer};
use tracing::{info, warn};

const BUILD_SHA: &str = match option_env!("BUILD_SHA") {
    Some(v) => v,
    None => "dev",
};
const PRODUCT_SLUG: &str = "guest-booking-confirm";

#[derive(Clone)]
struct AppState {
    db: SqlitePool,
    client: reqwest::Client,
    entra: auth::EntraValidator,
}

#[derive(Debug)]
struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"error": self.1}))).into_response()
    }
}

type ApiResult<T> = Result<T, ApiError>;

#[derive(Serialize, FromRow, Clone)]
struct Settings {
    business_name: String,
    service_name: String,
    timezone: String,
    duration_minutes: i64,
    weekly_hours: String,
    welcome_note: String,
    paid_until: Option<String>,
}

#[derive(Serialize, FromRow, Clone)]
struct Booking {
    id: String,
    reference: String,
    guest_name: String,
    email: String,
    phone: Option<String>,
    starts_at: String,
    timezone: String,
    duration_minutes: i64,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    guest_token: Option<String>,
    consent_at: String,
    reminder_done: i64,
    reminder_done_at: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Deserialize)]
struct SetupInput {
    business_name: String,
    service_name: String,
    timezone: String,
    duration_minutes: i64,
    weekly_hours: Value,
    #[serde(default)]
    welcome_note: String,
}
#[derive(Deserialize)]
struct BookingInput {
    guest_name: String,
    email: String,
    phone: Option<String>,
    starts_at: String,
    consent: bool,
}
#[derive(Deserialize)]
struct RescheduleInput {
    starts_at: String,
}
#[derive(Deserialize)]
struct SlotsQuery {
    from: Option<String>,
    days: Option<i64>,
}
#[derive(Deserialize)]
struct LicenseInput {
    license: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(filter)
        .init();
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:/data/guest-booking-confirm.db".into());
    if let Some(path) = database_url
        .strip_prefix("sqlite:")
        .and_then(|p| Path::new(p).parent())
    {
        tokio::fs::create_dir_all(path).await?;
    }
    let opts = SqliteConnectOptions::from_str(&database_url)?
        .create_if_missing(true)
        .foreign_keys(true)
        // Azure Files is the durable /data volume in production. WAL relies on
        // shared-memory semantics that SMB mounts do not provide reliably.
        .journal_mode(SqliteJournalMode::Delete)
        // Azure Files also cannot be trusted to preserve SQLite's default
        // POSIX advisory byte-range locks. The dot-file VFS coordinates with
        // atomic files instead; release enforcement keeps one process active.
        .vfs("unix-dotfile")
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(Duration::from_secs(5));
    let db = SqlitePoolOptions::new()
        // Every API request records its allowance in SQLite. One connection
        // avoids competing file locks on the single-replica Azure Files mount.
        .max_connections(1)
        .connect_with(opts)
        .await
        .context("connect sqlite")?;
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .context("migrate sqlite")?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()?;
    let state = AppState {
        db,
        entra: auth::EntraValidator::from_environment(client.clone()),
        client,
    };
    cleanup(&state.db).await.ok();
    info!(port, database = %database_url, build_sha = BUILD_SHA, identity_authority = %state.entra.authority(), config = "database and Sociobot Entra defaults used when overrides are absent", "service starting");
    let app = build_app(state);
    let listener = TcpListener::bind(("0.0.0.0", port)).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    Ok(())
}

fn build_app(state: AppState) -> Router {
    let api = Router::new()
        .route("/public/settings", get(public_settings))
        .route("/public/slots", get(public_slots))
        .route("/page-view", post(page_view))
        .route("/bookings", post(create_booking))
        .route("/guest/{token}", get(guest_booking))
        .route("/guest/{token}/confirm", post(guest_confirm))
        .route("/guest/{token}/cancel", post(guest_cancel))
        .route("/guest/{token}/reschedule", post(guest_reschedule))
        .route("/guest/{token}/calendar.ics", get(guest_ics))
        .route("/owner/status", get(owner_status))
        .route("/owner/setup", post(owner_setup))
        .route("/owner/claim", post(owner_claim))
        .route(
            "/owner/settings",
            get(owner_settings).patch(update_settings),
        )
        .route("/owner/bookings", get(owner_bookings))
        .route("/owner/bookings/{id}/{action}", patch(owner_action))
        .route("/license/verify", post(verify_license))
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit))
        .layer(DefaultBodyLimit::disable())
        .layer(RequestBodyLimitLayer::new(32 * 1024));

    Router::new()
        .route(
            "/health",
            get(|| async { Json(json!({"status":"ok","build_sha":BUILD_SHA})) }),
        )
        .nest("/api", api)
        .route("/", get(app_shell))
        .route("/demo", get(app_shell))
        .route("/manage", get(app_shell))
        .route("/auth/callback", get(app_shell))
        .route("/privacy", get(app_shell))
        .route("/terms", get(app_shell))
        .route("/404", get(app_shell))
        .route("/b/{token}", get(app_shell))
        .fallback(static_or_not_found)
        .layer(middleware::from_fn(security_headers))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn security_headers(req: Request, next: Next) -> Response {
    let path = req.uri().path().to_string();
    let mut response = next.run(req).await;
    let h = response.headers_mut();
    h.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    h.insert("x-frame-options", HeaderValue::from_static("DENY"));
    h.insert("referrer-policy", HeaderValue::from_static("same-origin"));
    h.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );
    h.insert("content-security-policy", HeaderValue::from_static("default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self' https://api.sociobot.in https://sociobotcustomers.ciamlogin.com; frame-src https://sociobotcustomers.ciamlogin.com; base-uri 'self'; form-action 'self' https://api.sociobot.in https://sociobotcustomers.ciamlogin.com; frame-ancestors 'none'"));
    if path.starts_with("/assets/") {
        h.insert(
            header::CACHE_CONTROL,
            HeaderValue::from_static("public, max-age=31536000, immutable"),
        );
    } else if path == "/sw.js"
        || path.ends_with(".html")
        || matches!(
            path.as_str(),
            "/" | "/demo" | "/manage" | "/auth/callback" | "/privacy" | "/terms"
        )
    {
        h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    }
    response
}

async fn app_shell() -> Response {
    html_file("dist/index.html", StatusCode::OK).await
}

async fn static_or_not_found(req: Request) -> Response {
    match ServeDir::new("dist").oneshot(req).await {
        Ok(response) if response.status() != StatusCode::NOT_FOUND => response.into_response(),
        _ => html_file("dist/404.html", StatusCode::NOT_FOUND).await,
    }
}

async fn html_file(path: &str, status: StatusCode) -> Response {
    match tokio::fs::read(path).await {
        Ok(body) => (
            status,
            [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
            body,
        )
            .into_response(),
        Err(_) => (status, "Not found").into_response(),
    }
}

async fn rate_limit(State(state): State<AppState>, req: Request, next: Next) -> Response {
    let forwarded = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .map(str::trim);
    let direct = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip().to_string());
    let client = forwarded
        .map(str::to_owned)
        .or(direct)
        .unwrap_or_else(|| "unknown".into());
    let class = if req.method() == Method::GET {
        "read"
    } else {
        "write"
    };
    let key = format!("{class}:{client}");
    let max = if req.method() == Method::GET { 40 } else { 12 };
    let now_ms = Utc::now().timestamp_millis();
    let allowed = record_rate_limit(&state.db, &key, now_ms, max).await;
    let allowed = match allowed {
        Ok(value) => value,
        Err(error) => {
            warn!(%error, "rate limit state unavailable");
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error":"The booking desk is busy. Try again in a moment."})),
            )
                .into_response();
        }
    };
    if !allowed {
        let mut res = (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({"error":"Too many requests. Try again in a moment."})),
        )
            .into_response();
        res.headers_mut()
            .insert(header::RETRY_AFTER, HeaderValue::from_static("1"));
        return res;
    }
    next.run(req).await
}

async fn record_rate_limit(
    db: &SqlitePool,
    key: &str,
    now_ms: i64,
    max: i64,
) -> Result<bool, sqlx::Error> {
    let mut transaction = db.begin().await?;
    let cutoff = now_ms - 1_000;
    sqlx::query("DELETE FROM rate_limit_events WHERE occurred_at_ms <= ?")
        .bind(cutoff)
        .execute(&mut *transaction)
        .await?;
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM rate_limit_events WHERE client_key = ?")
            .bind(key)
            .fetch_one(&mut *transaction)
            .await?;
    let allowed = count < max;
    if allowed {
        sqlx::query(
            "INSERT INTO rate_limit_events(client_key,occurred_at_ms,event_id) VALUES(?,?,?)",
        )
        .bind(key)
        .bind(now_ms)
        .bind(random_token(16))
        .execute(&mut *transaction)
        .await?;
    }
    transaction.commit().await?;
    Ok(allowed)
}

async fn public_settings(State(state): State<AppState>) -> ApiResult<Json<Value>> {
    let s = get_settings(&state.db).await?;
    Ok(Json(match s {
        Some(x) => {
            json!({"configured":true,"business_name":x.business_name,"service_name":x.service_name,"timezone":x.timezone,"duration_minutes":x.duration_minutes,"weekly_hours":serde_json::from_str::<Value>(&x.weekly_hours).unwrap_or(json!({})),"welcome_note":x.welcome_note})
        }
        None => json!({"configured":false}),
    }))
}

async fn public_slots(
    State(state): State<AppState>,
    Query(q): Query<SlotsQuery>,
) -> ApiResult<Json<Value>> {
    let s = get_settings(&state.db).await?.ok_or_else(|| {
        ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "This booking page is not set up yet.".into(),
        )
    })?;
    let tz: Tz = s.timezone.parse().map_err(|_| {
        ApiError(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Business timezone is invalid.".into(),
        )
    })?;
    let hours: Value = serde_json::from_str(&s.weekly_hours).unwrap_or(json!({}));
    let start = q
        .from
        .as_deref()
        .and_then(|v| NaiveDate::parse_from_str(v, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().with_timezone(&tz).date_naive());
    let days = q.days.unwrap_or(14).clamp(1, 31);
    let busy: Vec<String> = sqlx::query_scalar("SELECT starts_at FROM bookings WHERE status IN ('awaiting_confirmation','confirmed') AND starts_at >= ?")
        .bind(Utc::now().to_rfc3339()).fetch_all(&state.db).await.map_err(db_error)?;
    let mut slots = Vec::new();
    for offset in 0..days {
        let date = start + ChronoDuration::days(offset);
        let key = match date.weekday().num_days_from_monday() {
            0 => "mon",
            1 => "tue",
            2 => "wed",
            3 => "thu",
            4 => "fri",
            5 => "sat",
            _ => "sun",
        };
        let Some(range) = hours.get(key).and_then(Value::as_array) else {
            continue;
        };
        if range.len() != 2 {
            continue;
        }
        let parse_mins = |v: &Value| {
            v.as_str().and_then(|s| {
                let mut p = s.split(':');
                Some(p.next()?.parse::<i64>().ok()? * 60 + p.next()?.parse::<i64>().ok()?)
            })
        };
        let (Some(open), Some(close)) = (parse_mins(&range[0]), parse_mins(&range[1])) else {
            continue;
        };
        let mut minute = open;
        while minute + s.duration_minutes <= close {
            let naive = date
                .and_hms_opt((minute / 60) as u32, (minute % 60) as u32, 0)
                .unwrap();
            if let LocalResult::Single(local) = tz.from_local_datetime(&naive) {
                let utc = local.with_timezone(&Utc);
                let iso = utc.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
                if utc > Utc::now() + ChronoDuration::minutes(30)
                    && !busy.iter().any(|b| {
                        DateTime::parse_from_rfc3339(b)
                            .map(|d| d.with_timezone(&Utc) == utc)
                            .unwrap_or(false)
                    })
                {
                    slots.push(
                        json!({"start":iso,"local":local.to_rfc3339(),"date":date.to_string()}),
                    );
                }
            }
            minute += s.duration_minutes;
        }
    }
    Ok(Json(json!({"slots":slots,"timezone":s.timezone})))
}

async fn page_view(State(state): State<AppState>) -> StatusCode {
    let day = Utc::now().date_naive().to_string();
    let _ = sqlx::query("INSERT INTO page_counts(day,count) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET count=count+1").bind(day).execute(&state.db).await;
    StatusCode::NO_CONTENT
}

async fn create_booking(
    State(state): State<AppState>,
    Json(input): Json<BookingInput>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let s = get_settings(&state.db).await?.ok_or_else(|| {
        ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "This booking page is not accepting requests yet.".into(),
        )
    })?;
    validate_name_email(&input.guest_name, &input.email)?;
    if !input.consent {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Consent is required to keep your booking details.".into(),
        ));
    }
    if input
        .phone
        .as_deref()
        .map(|x| x.len() > 30)
        .unwrap_or(false)
    {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Phone number is too long.".into(),
        ));
    }
    let start = parse_future(&input.starts_at)?;
    let paid = s
        .paid_until
        .as_deref()
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|v| v > Utc::now())
        .unwrap_or(false);
    let valid_slots = public_slots(
        State(state.clone()),
        Query(SlotsQuery {
            from: Some(
                start
                    .with_timezone(&s.timezone.parse::<Tz>().unwrap_or(chrono_tz::UTC))
                    .date_naive()
                    .to_string(),
            ),
            days: Some(1),
        }),
    )
    .await?
    .0;
    if !valid_slots["slots"]
        .as_array()
        .map(|a| {
            a.iter().any(|x| {
                x["start"]
                    .as_str()
                    .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
                    .map(|d| d.with_timezone(&Utc) == start)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
    {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "That time is no longer available. Choose another slot.".into(),
        ));
    }
    let token = random_token(40);
    let token_hash = hash(&token);
    let id = random_token(18);
    let reference = format!("GBC-{}", random_code(6));
    let now = Utc::now().to_rfc3339();
    let inserted = sqlx::query("INSERT INTO bookings(id,reference,guest_name,email,phone,starts_at,timezone,duration_minutes,status,guest_token,guest_token_hash,consent_at,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ?=1 OR (SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled','completed') AND starts_at > ?)<30")
        .bind(&id)
        .bind(&reference)
        .bind(input.guest_name.trim())
        .bind(input.email.trim().to_lowercase())
        .bind(input.phone.as_deref().map(str::trim))
        .bind(start.to_rfc3339())
        .bind(&s.timezone)
        .bind(s.duration_minutes)
        .bind("requested")
        .bind(&token)
        .bind(token_hash)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .bind(i64::from(paid))
        .bind(&now)
        .execute(&state.db)
        .await
        .map_err(|error| {
            warn!(%error, "booking insert rejected");
            ApiError(
                StatusCode::CONFLICT,
                "That request collided with another update. Choose the time again.".into(),
            )
        })?;
    if inserted.rows_affected() != 1 {
        return Err(ApiError(StatusCode::CONFLICT, "This calendar has reached its free 30-booking limit. Please contact the business directly.".into()));
    }
    Ok((
        StatusCode::CREATED,
        Json(json!({"token":token,"reference":reference,"status":"requested"})),
    ))
}

async fn guest_booking(
    State(state): State<AppState>,
    AxumPath(token): AxumPath<String>,
) -> ApiResult<Json<Value>> {
    let b = booking_by_token(&state.db, &token).await?;
    let s = get_settings(&state.db)
        .await?
        .ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Booking not found.".into()))?;
    Ok(Json(
        json!({"booking":guest_view(&b),"business_name":s.business_name,"service_name":s.service_name}),
    ))
}

async fn guest_confirm(
    State(state): State<AppState>,
    AxumPath(token): AxumPath<String>,
) -> ApiResult<Json<Value>> {
    let b = booking_by_token(&state.db, &token).await?;
    if b.status != "awaiting_confirmation" {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This confirmation link has already been used or the request is not ready.".into(),
        ));
    }
    if !transition_from_status(&state.db, &b.id, &b.status, "confirmed").await? {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This confirmation link has already been used or the request is not ready.".into(),
        ));
    }
    Ok(Json(json!({"status":"confirmed"})))
}

async fn guest_cancel(
    State(state): State<AppState>,
    AxumPath(token): AxumPath<String>,
) -> ApiResult<Json<Value>> {
    let b = booking_by_token(&state.db, &token).await?;
    if matches!(b.status.as_str(), "cancelled" | "completed") {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This booking is already closed.".into(),
        ));
    }
    if !transition_from_status(&state.db, &b.id, &b.status, "cancelled").await? {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This booking was just changed. Refresh the private link to see its current state."
                .into(),
        ));
    }
    Ok(Json(json!({"status":"cancelled"})))
}

async fn guest_reschedule(
    State(state): State<AppState>,
    AxumPath(token): AxumPath<String>,
    Json(input): Json<RescheduleInput>,
) -> ApiResult<Json<Value>> {
    let b = booking_by_token(&state.db, &token).await?;
    if matches!(
        b.status.as_str(),
        "cancelled" | "completed" | "reschedule_requested"
    ) {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This reschedule link has already been used or the booking is closed.".into(),
        ));
    }
    let start = parse_future(&input.starts_at)?;
    let settings = get_settings(&state.db).await?.ok_or_else(|| {
        ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "This booking page is not set up.".into(),
        )
    })?;
    let timezone = settings.timezone.parse::<Tz>().unwrap_or(chrono_tz::UTC);
    let available = public_slots(
        State(state.clone()),
        Query(SlotsQuery {
            from: Some(start.with_timezone(&timezone).date_naive().to_string()),
            days: Some(1),
        }),
    )
    .await?
    .0;
    let is_open = available["slots"].as_array().is_some_and(|slots| {
        slots.iter().any(|slot| {
            slot["start"]
                .as_str()
                .and_then(|value| DateTime::parse_from_rfc3339(value).ok())
                .is_some_and(|value| value.with_timezone(&Utc) == start)
        })
    });
    if !is_open {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "That time is no longer available. Choose another slot.".into(),
        ));
    }
    let result = sqlx::query("UPDATE bookings SET starts_at=?,status='reschedule_requested',reminder_done=0,reminder_done_at=NULL,updated_at=? WHERE id=? AND status=?")
        .bind(start.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .bind(&b.id)
        .bind(&b.status)
        .execute(&state.db)
        .await
        .map_err(db_error)?;
    if result.rows_affected() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This reschedule link has already been used or the booking was just changed.".into(),
        ));
    }
    Ok(Json(json!({"status":"reschedule_requested"})))
}

async fn guest_ics(
    State(state): State<AppState>,
    AxumPath(token): AxumPath<String>,
) -> ApiResult<Response> {
    let b = booking_by_token(&state.db, &token).await?;
    if b.status != "confirmed" {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "The calendar file is available after you confirm.".into(),
        ));
    }
    let s = get_settings(&state.db).await?.unwrap();
    let start = DateTime::parse_from_rfc3339(&b.starts_at)
        .map_err(|_| {
            ApiError(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Stored time is invalid.".into(),
            )
        })?
        .with_timezone(&Utc);
    let end = start + ChronoDuration::minutes(b.duration_minutes);
    let esc = |v: &str| {
        v.replace('\\', "\\\\")
            .replace(',', "\\,")
            .replace(';', "\\;")
            .replace('\n', "\\n")
    };
    let body = format!("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Sociobot//Guest Booking Confirm//EN\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:{}@guest-booking-confirm.sociobot.in\r\nDTSTAMP:{}\r\nDTSTART:{}\r\nDTEND:{}\r\nSUMMARY:{} — {}\r\nDESCRIPTION:Booking reference {}. Keep your private booking link to make changes.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n", b.id, ics_date(Utc::now()), ics_date(start), ics_date(end), esc(&s.service_name), esc(&s.business_name), esc(&b.reference));
    Ok((
        [
            (header::CONTENT_TYPE, "text/calendar; charset=utf-8"),
            (
                header::CONTENT_DISPOSITION,
                "attachment; filename=booking.ics",
            ),
        ],
        body,
    )
        .into_response())
}

async fn owner_status(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let oid = authenticated_owner_oid(&state, &headers).await?;
    let owner: Option<Option<String>> =
        sqlx::query_scalar("SELECT owner_oid FROM settings WHERE id=1")
            .fetch_optional(&state.db)
            .await
            .map_err(db_error)?;
    match owner {
        None => Ok(Json(json!({"configured":false,"legacy_owner":false}))),
        Some(None) => Ok(Json(json!({"configured":true,"legacy_owner":true}))),
        Some(Some(owner_oid)) if owner_oid == oid => {
            Ok(Json(json!({"configured":true,"legacy_owner":false})))
        }
        Some(Some(_)) => Err(ApiError(
            StatusCode::FORBIDDEN,
            "This booking desk belongs to another Sociobot account.".into(),
        )),
    }
}

async fn owner_setup(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SetupInput>,
) -> ApiResult<(StatusCode, Json<Value>)> {
    let owner_oid = authenticated_owner_oid(&state, &headers).await?;
    if get_settings(&state.db).await?.is_some() {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Owner setup is already complete.".into(),
        ));
    }
    validate_setup(&input)?;
    let weekly = serde_json::to_string(&input.weekly_hours)
        .map_err(|_| ApiError(StatusCode::BAD_REQUEST, "Hours are invalid.".into()))?;
    sqlx::query("INSERT INTO settings(id,business_name,service_name,timezone,duration_minutes,weekly_hours,welcome_note,owner_oid,created_at) VALUES(1,?,?,?,?,?,?,?,?)")
        .bind(input.business_name.trim())
        .bind(input.service_name.trim())
        .bind(input.timezone)
        .bind(input.duration_minutes)
        .bind(weekly)
        .bind(input.welcome_note.trim())
        .bind(owner_oid)
        .bind(Utc::now().to_rfc3339())
        .execute(&state.db)
        .await
        .map_err(db_error)?;
    Ok((StatusCode::CREATED, Json(json!({"saved":true}))))
}

async fn owner_claim(State(state): State<AppState>, headers: HeaderMap) -> ApiResult<Json<Value>> {
    let owner_oid = authenticated_owner_oid(&state, &headers).await?;
    let updated = sqlx::query("UPDATE settings SET owner_oid=? WHERE id=1 AND owner_oid IS NULL")
        .bind(owner_oid)
        .execute(&state.db)
        .await
        .map_err(db_error)?;
    if updated.rows_affected() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "This booking desk has already been connected to an owner.".into(),
        ));
    }
    Ok(Json(json!({"saved":true})))
}

async fn owner_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers).await?;
    let s = get_settings(&state.db)
        .await?
        .ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Setup is incomplete.".into()))?;
    Ok(Json(
        json!({"business_name":s.business_name,"service_name":s.service_name,"timezone":s.timezone,"duration_minutes":s.duration_minutes,"weekly_hours":serde_json::from_str::<Value>(&s.weekly_hours).unwrap_or(json!({})),"welcome_note":s.welcome_note,"paid":is_paid(&s)}),
    ))
}

async fn update_settings(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<SetupInput>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers).await?;
    validate_setup(&input)?;
    sqlx::query("UPDATE settings SET business_name=?,service_name=?,timezone=?,duration_minutes=?,weekly_hours=?,welcome_note=? WHERE id=1").bind(input.business_name.trim()).bind(input.service_name.trim()).bind(input.timezone).bind(input.duration_minutes).bind(input.weekly_hours.to_string()).bind(input.welcome_note.trim()).execute(&state.db).await.map_err(db_error)?;
    Ok(Json(json!({"saved":true})))
}

async fn owner_bookings(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers).await?;
    cleanup(&state.db).await.ok();
    let bookings: Vec<Booking> = sqlx::query_as("SELECT id,reference,guest_name,email,phone,starts_at,timezone,duration_minutes,status,guest_token,consent_at,reminder_done,reminder_done_at,created_at,updated_at FROM bookings ORDER BY starts_at ASC").fetch_all(&state.db).await.map_err(db_error)?;
    Ok(Json(json!({"bookings":bookings})))
}

async fn owner_action(
    State(state): State<AppState>,
    AxumPath((id, action)): AxumPath<(String, String)>,
    headers: HeaderMap,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers).await?;
    let b: Option<Booking> = sqlx::query_as("SELECT id,reference,guest_name,email,phone,starts_at,timezone,duration_minutes,status,guest_token,consent_at,reminder_done,reminder_done_at,created_at,updated_at FROM bookings WHERE id=?").bind(&id).fetch_optional(&state.db).await.map_err(db_error)?;
    let b = b.ok_or_else(|| ApiError(StatusCode::NOT_FOUND, "Booking not found.".into()))?;
    match action.as_str() {
        "approve" if matches!(b.status.as_str(), "requested" | "reschedule_requested") => {
            if !approve_booking(&state.db, &id).await? {
                return Err(ApiError(
                    StatusCode::CONFLICT,
                    "Another accepted booking now uses this slot.".into(),
                ));
            }
        }
        "cancel" if !matches!(b.status.as_str(), "cancelled" | "completed") => {
            set_status(&state.db, &id, "cancelled").await?
        }
        "complete" if b.status == "confirmed" => set_status(&state.db, &id, "completed").await?,
        "reminder" if matches!(b.status.as_str(), "awaiting_confirmation" | "confirmed") => {
            sqlx::query(
                "UPDATE bookings SET reminder_done=1,reminder_done_at=?,updated_at=? WHERE id=?",
            )
            .bind(Utc::now().to_rfc3339())
            .bind(Utc::now().to_rfc3339())
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(db_error)?;
        }
        "unremind" => {
            sqlx::query(
                "UPDATE bookings SET reminder_done=0,reminder_done_at=NULL,updated_at=? WHERE id=?",
            )
            .bind(Utc::now().to_rfc3339())
            .bind(&id)
            .execute(&state.db)
            .await
            .map_err(db_error)?;
        }
        _ => {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "That action is not available for this booking state.".into(),
            ))
        }
    }
    Ok(Json(json!({"saved":true})))
}

async fn verify_license(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(input): Json<LicenseInput>,
) -> ApiResult<Json<Value>> {
    authorize(&state, &headers).await?;
    if input.license.len() < 10 || input.license.len() > 1000 {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "License format is invalid.".into(),
        ));
    }
    let url = format!(
        "https://api.sociobot.in/api/v1/products/{PRODUCT_SLUG}/verify?license={}",
        urlencoding(&input.license)
    );
    let verdict: Value = state
        .client
        .get(url)
        .send()
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::BAD_GATEWAY,
                "License service is temporarily unavailable. Free features still work.".into(),
            )
        })?
        .json()
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::BAD_GATEWAY,
                "License service returned an unreadable response.".into(),
            )
        })?;
    apply_license_verdict(&state.db, &verdict).await?;
    Ok(Json(verdict))
}

async fn apply_license_verdict(db: &SqlitePool, verdict: &Value) -> ApiResult<()> {
    if verdict["valid"].as_bool() == Some(true) {
        let until = verdict["expires_at"]
            .as_str()
            .map(str::to_string)
            .unwrap_or_else(|| (Utc::now() + ChronoDuration::days(3650)).to_rfc3339());
        sqlx::query("UPDATE settings SET paid_until=? WHERE id=1")
            .bind(until)
            .execute(db)
            .await
            .map_err(db_error)?;
    } else {
        sqlx::query("UPDATE settings SET paid_until=NULL WHERE id=1")
            .execute(db)
            .await
            .map_err(db_error)?;
    }
    Ok(())
}

fn guest_view(b: &Booking) -> Value {
    json!({"reference":b.reference,"guest_name":b.guest_name,"starts_at":b.starts_at,"timezone":b.timezone,"duration_minutes":b.duration_minutes,"status":b.status,"updated_at":b.updated_at})
}
async fn booking_by_token(db: &SqlitePool, token: &str) -> ApiResult<Booking> {
    if token.len() < 20 || token.len() > 100 {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            "Booking link is invalid.".into(),
        ));
    }
    sqlx::query_as("SELECT id,reference,guest_name,email,phone,starts_at,timezone,duration_minutes,status,NULL AS guest_token,consent_at,reminder_done,reminder_done_at,created_at,updated_at FROM bookings WHERE guest_token_hash=?").bind(hash(token)).fetch_optional(db).await.map_err(db_error)?.ok_or_else(|| ApiError(StatusCode::NOT_FOUND,"This private booking link is invalid or has expired.".into()))
}
async fn get_settings(db: &SqlitePool) -> ApiResult<Option<Settings>> {
    sqlx::query_as("SELECT business_name,service_name,timezone,duration_minutes,weekly_hours,welcome_note,paid_until FROM settings WHERE id=1").fetch_optional(db).await.map_err(db_error)
}
async fn set_status(db: &SqlitePool, id: &str, status: &str) -> ApiResult<()> {
    sqlx::query("UPDATE bookings SET status=?,updated_at=? WHERE id=?")
        .bind(status)
        .bind(Utc::now().to_rfc3339())
        .bind(id)
        .execute(db)
        .await
        .map_err(db_error)?;
    Ok(())
}
async fn transition_from_status(
    db: &SqlitePool,
    id: &str,
    expected_status: &str,
    next_status: &str,
) -> ApiResult<bool> {
    let result = sqlx::query("UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status=?")
        .bind(next_status)
        .bind(Utc::now().to_rfc3339())
        .bind(id)
        .bind(expected_status)
        .execute(db)
        .await
        .map_err(db_error)?;
    Ok(result.rows_affected() == 1)
}
async fn approve_booking(db: &SqlitePool, id: &str) -> ApiResult<bool> {
    let result = sqlx::query("UPDATE bookings SET status='awaiting_confirmation',updated_at=? WHERE id=? AND status IN ('requested','reschedule_requested') AND NOT EXISTS (SELECT 1 FROM bookings AS accepted WHERE accepted.id != ? AND accepted.starts_at = bookings.starts_at AND accepted.status IN ('awaiting_confirmation','confirmed'))")
        .bind(Utc::now().to_rfc3339())
        .bind(id)
        .bind(id)
        .execute(db)
        .await
        .map_err(db_error)?;
    Ok(result.rows_affected() == 1)
}
fn validate_name_email(name: &str, email: &str) -> ApiResult<()> {
    let name_length = name.trim().chars().count();
    if !(2..=80).contains(&name_length) {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Enter your name (2–80 characters).".into(),
        ));
    }
    if email.len() > 254 || !email.contains('@') || email.starts_with('@') || email.ends_with('@') {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Enter a valid email address.".into(),
        ));
    }
    Ok(())
}

fn validate_setup(i: &SetupInput) -> ApiResult<()> {
    if !(2..=80).contains(&i.business_name.trim().chars().count()) {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Business name must be 2–80 characters.".into(),
        ));
    }
    if !(2..=80).contains(&i.service_name.trim().chars().count()) {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Service name must be 2–80 characters.".into(),
        ));
    }
    if i.timezone.parse::<Tz>().is_err() {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Choose a valid IANA timezone.".into(),
        ));
    }
    if !(15..=480).contains(&i.duration_minutes) {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Duration must be 15–480 minutes.".into(),
        ));
    }
    validate_weekly_hours(&i.weekly_hours, i.duration_minutes)
}
fn validate_weekly_hours(hours: &Value, duration_minutes: i64) -> ApiResult<()> {
    let object = hours.as_object().ok_or_else(|| {
        ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Hours must list each open day as a start and closing time.".into(),
        )
    })?;
    let days = [
        ("mon", "Monday"),
        ("tue", "Tuesday"),
        ("wed", "Wednesday"),
        ("thu", "Thursday"),
        ("fri", "Friday"),
        ("sat", "Saturday"),
        ("sun", "Sunday"),
    ];
    if object
        .keys()
        .any(|key| !days.iter().any(|(code, _)| key == code))
    {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Hours may use only Monday through Sunday.".into(),
        ));
    }
    for (code, name) in days {
        let Some(value) = object.get(code) else {
            continue;
        };
        if value.is_null() {
            continue;
        }
        let range = value
            .as_array()
            .filter(|range| range.len() == 2)
            .ok_or_else(|| {
                ApiError(
                    StatusCode::UNPROCESSABLE_ENTITY,
                    format!("{name} hours must include an opening and closing time."),
                )
            })?;
        let open = range[0].as_str().and_then(parse_clock).ok_or_else(|| {
            ApiError(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("{name} opening time must use 24-hour HH:MM time."),
            )
        })?;
        let close = range[1].as_str().and_then(parse_clock).ok_or_else(|| {
            ApiError(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("{name} closing time must use 24-hour HH:MM time."),
            )
        })?;
        if close <= open {
            return Err(ApiError(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("{name} closing time must be later than opening time."),
            ));
        }
        if close - open < duration_minutes {
            return Err(ApiError(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("{name} hours must fit at least one appointment."),
            ));
        }
    }
    Ok(())
}
fn parse_clock(value: &str) -> Option<i64> {
    let bytes = value.as_bytes();
    if bytes.len() != 5
        || bytes[2] != b':'
        || !bytes
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 2 || byte.is_ascii_digit())
    {
        return None;
    }
    let hour = value[0..2].parse::<i64>().ok()?;
    let minute = value[3..5].parse::<i64>().ok()?;
    (hour < 24 && minute < 60).then_some(hour * 60 + minute)
}
fn parse_future(v: &str) -> ApiResult<DateTime<Utc>> {
    let d = DateTime::parse_from_rfc3339(v)
        .map_err(|_| {
            ApiError(
                StatusCode::UNPROCESSABLE_ENTITY,
                "Choose a valid appointment time.".into(),
            )
        })?
        .with_timezone(&Utc);
    if d < Utc::now() + ChronoDuration::minutes(20) || d > Utc::now() + ChronoDuration::days(366) {
        return Err(ApiError(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Choose a time between 20 minutes and one year from now.".into(),
        ));
    }
    Ok(d)
}
fn hash(v: &str) -> String {
    hex::encode(Sha256::digest(v.as_bytes()))
}
fn random_token(n: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(n)
        .map(char::from)
        .collect()
}
fn random_code(n: usize) -> String {
    const C: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let mut rng = rand::thread_rng();
    (0..n)
        .map(|_| C[rng.gen_range(0..C.len())] as char)
        .collect()
}
fn ics_date(d: DateTime<Utc>) -> String {
    d.format("%Y%m%dT%H%M%SZ").to_string()
}
fn db_error(e: sqlx::Error) -> ApiError {
    warn!(error=%e,"database error");
    ApiError(
        StatusCode::INTERNAL_SERVER_ERROR,
        "The booking desk could not save that. Try again.".into(),
    )
}
async fn authenticated_owner_oid(state: &AppState, headers: &HeaderMap) -> ApiResult<String> {
    state.entra.owner_oid(headers).await.map_err(|_| {
        ApiError(
            StatusCode::UNAUTHORIZED,
            "Sign in with your Sociobot account to continue.".into(),
        )
    })
}
async fn authorize(state: &AppState, headers: &HeaderMap) -> ApiResult<()> {
    let oid = authenticated_owner_oid(state, headers).await?;
    let owner_oid: Option<String> = sqlx::query_scalar("SELECT owner_oid FROM settings WHERE id=1")
        .fetch_optional(&state.db)
        .await
        .map_err(db_error)?
        .flatten();
    if owner_oid.as_deref() == Some(&oid) {
        return Ok(());
    }
    Err(ApiError(
        StatusCode::FORBIDDEN,
        "This booking desk belongs to another Sociobot account.".into(),
    ))
}
fn is_paid(s: &Settings) -> bool {
    s.paid_until
        .as_deref()
        .and_then(|v| DateTime::parse_from_rfc3339(v).ok())
        .map(|v| v > Utc::now())
        .unwrap_or(false)
}
async fn cleanup(db: &SqlitePool) -> anyhow::Result<()> {
    let s:Option<Settings>=sqlx::query_as("SELECT business_name,service_name,timezone,duration_minutes,weekly_hours,welcome_note,paid_until FROM settings WHERE id=1").fetch_optional(db).await?;
    let days = if s.as_ref().map(is_paid).unwrap_or(false) {
        365
    } else {
        30
    };
    let cutoff = (Utc::now() - ChronoDuration::days(days)).to_rfc3339();
    sqlx::query("DELETE FROM bookings WHERE starts_at < ? AND status IN ('cancelled','completed')")
        .bind(cutoff)
        .execute(db)
        .await?;
    Ok(())
}
fn urlencoding(v: &str) -> String {
    v.bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
                (b as char).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}
async fn shutdown() {
    let ctrl_c = async { signal::ctrl_c().await.expect("install ctrl-c handler") };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("install signal handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {_=ctrl_c=>{},_=terminate=>{}}
    info!("shutdown signal received");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};

    async fn test_state() -> (AppState, std::path::PathBuf) {
        let path = std::env::temp_dir().join(format!(
            "guest-booking-confirm-{}-{}.db",
            std::process::id(),
            random_token(12)
        ));
        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))
            .unwrap()
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(5));
        let db = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&db).await.unwrap();
        let client = reqwest::Client::new();
        (
            AppState {
                db,
                entra: auth::EntraValidator::from_environment(client.clone()),
                client,
            },
            path,
        )
    }

    async fn seed_test_settings(db: &SqlitePool, paid_until: Option<String>) {
        sqlx::query("INSERT INTO settings(id,business_name,service_name,timezone,duration_minutes,weekly_hours,welcome_note,owner_oid,paid_until,created_at) VALUES(1,?,?,?,?,?,?,?,?,?)")
            .bind("Signal Studio")
            .bind("Consultation")
            .bind("UTC")
            .bind(30_i64)
            .bind(r#"{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"],"sat":["09:00","17:00"],"sun":["09:00","17:00"]}"#)
            .bind("")
            .bind("test-owner")
            .bind(paid_until)
            .bind(Utc::now().to_rfc3339())
            .execute(db)
            .await
            .unwrap();
    }

    async fn test_slot(state: &AppState) -> String {
        public_slots(
            State(state.clone()),
            Query(SlotsQuery {
                from: None,
                days: Some(14),
            }),
        )
        .await
        .unwrap()
        .0["slots"]
            .as_array()
            .unwrap()
            .first()
            .unwrap()["start"]
            .as_str()
            .unwrap()
            .to_string()
    }

    async fn create_test_booking(
        state: &AppState,
        start: &str,
        number: usize,
    ) -> ApiResult<(StatusCode, Json<Value>)> {
        create_booking(
            State(state.clone()),
            Json(BookingInput {
                guest_name: format!("Guest {number}"),
                email: format!("guest-{number}@example.test"),
                phone: None,
                starts_at: start.to_string(),
                consent: true,
            }),
        )
        .await
    }

    async fn seed_closed_booking(db: &SqlitePool, id: &str, age_days: i64) {
        let date = (Utc::now() - ChronoDuration::days(age_days)).to_rfc3339();
        let token = format!("{}{}", id, "x".repeat(40));
        sqlx::query("INSERT INTO bookings(id,reference,guest_name,email,starts_at,timezone,duration_minutes,status,guest_token,guest_token_hash,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id)
            .bind(format!("GBC-{id}"))
            .bind("Closed guest")
            .bind(format!("{id}@example.test"))
            .bind(&date)
            .bind("UTC")
            .bind(30_i64)
            .bind("completed")
            .bind(&token)
            .bind(hash(&token))
            .bind(&date)
            .bind(&date)
            .bind(&date)
            .execute(db)
            .await
            .unwrap();
    }

    async fn seed_requested_booking(db: &SqlitePool, id: &str, start: &str) {
        let now = Utc::now().to_rfc3339();
        let token = format!("{id}{}", "x".repeat(40));
        sqlx::query("INSERT INTO bookings(id,reference,guest_name,email,starts_at,timezone,duration_minutes,status,guest_token,guest_token_hash,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind(id)
            .bind(format!("GBC-{id}"))
            .bind("Requested guest")
            .bind(format!("{id}@example.test"))
            .bind(start)
            .bind("UTC")
            .bind(30_i64)
            .bind("requested")
            .bind(&token)
            .bind(hash(&token))
            .bind(&now)
            .bind(&now)
            .bind(&now)
            .execute(db)
            .await
            .unwrap();
    }

    #[test]
    fn validates_email_and_name() {
        assert!(validate_name_email("Ada Lovelace", "ada@example.com").is_ok());
        assert!(validate_name_email("李小", "li@example.com").is_ok());
        assert!(validate_name_email("A", "ada@example.com").is_err());
        assert!(validate_name_email("李", "li@example.com").is_err());
        assert!(validate_name_email(&"界".repeat(81), "long@example.com").is_err());
    }
    #[test]
    fn hashes_tokens_without_echoing() {
        assert_eq!(hash("a").len(), 64);
        assert_ne!(hash("a"), "a");
    }

    #[test]
    fn dockerfile_uses_the_unpinned_current_stable_rust_builder() {
        let dockerfile = include_str!("../Dockerfile");
        let builder = dockerfile
            .lines()
            .find(|line| line.starts_with("FROM rust:"))
            .expect("Dockerfile must declare a Rust builder stage");

        assert_eq!(
            builder, "FROM rust:1-slim AS backend",
            "the factory build must use the unpinned current-stable Rust slim image"
        );
        assert!(
            !builder.contains("rust:1."),
            "a minor-pinned Rust builder can fail when Cargo.lock needs newer rustc"
        );
    }

    #[test]
    fn claim_container_runtime_contract() {
        let dockerfile = include_str!("../Dockerfile");
        let server = include_str!("main.rs");
        let service_worker = include_str!("../public/sw.js");
        let deployment = include_str!("../deploy/enforce-single-replica.sh");
        let persistent_data = include_str!("../deploy/ensure-persistent-data.sh");
        let safe_template = include_str!("../deploy/apply-safe-template.sh");
        let live_topology = include_str!("../deploy/verify-live-topology.sh");
        let release = include_str!("../deploy/release.sh");
        assert!(dockerfile.contains("useradd --uid 10001"));
        assert!(dockerfile.contains("USER app"));
        assert!(dockerfile.contains("ENV PORT=8080"));
        assert!(server.contains("sqlite:/data/guest-booking-confirm.db"));
        assert!(server.contains("journal_mode(SqliteJournalMode::Delete)"));
        assert!(server.contains("vfs(\"unix-dotfile\")"));
        assert!(server.contains("max_connections(1)"));
        assert!(server.contains(".with_graceful_shutdown(shutdown())"));
        assert!(server.contains("SignalKind::terminate()"));
        assert!(service_worker.contains("path === '/auth/callback'"));
        assert!(deployment.contains("--min-replicas 1"));
        assert!(deployment.contains("--max-replicas 1"));
        assert!(deployment.contains("properties.template.scale.minReplicas"));
        assert!(deployment.contains("one active revision and one running replica"));
        assert!(persistent_data.contains("storageType:\"AzureFile\""));
        assert!(persistent_data.contains("mount_path=\"/data\""));
        assert!(persistent_data.contains("PREPARE_STORAGE_ONLY"));
        assert!(persistent_data.contains("Persistent data mount verification failed"));
        assert!(safe_template.contains("storageType:\"AzureFile\""));
        assert!(safe_template.contains(".minReplicas = 1"));
        assert!(safe_template.contains(".maxReplicas = 1"));
        assert!(safe_template.contains("volumeMounts"));
        assert!(safe_template.contains("Safe template verification failed"));
        assert!(live_topology.contains("containerapp revision show"));
        assert!(live_topology.contains("Serving topology verification failed"));
        let build = release
            .find("az acr build")
            .expect("release must build the exact image in ACR");
        let storage_preparation = release
            .find("PREPARE_STORAGE_ONLY=1")
            .expect("release must register Azure Files before publishing the image");
        let safe_publish = release
            .find("apply-safe-template.sh")
            .expect("release must publish the image with its safe template");
        let initial_replica_enforcement = release
            .find("enforce-single-replica.sh")
            .expect("release must enforce the SQLite topology");
        assert!(
            build < storage_preparation
                && storage_preparation < initial_replica_enforcement
                && initial_replica_enforcement < safe_publish,
            "the image must be published only after Azure Files is ready and old traffic is converged to one replica"
        );
        assert!(
            !release.contains("factory_deploy_script"),
            "the unsafe generic max=3/no-volume publisher must not be part of this release path"
        );
        assert!(
            release.contains("verify-live-topology.sh"),
            "the serving revision, not merely the desired template, must be verified before release completes"
        );
    }

    #[test]
    fn claim_generated_artwork_provenance() {
        let app = include_str!("../frontend/src/app.ts");
        let design = include_str!("../.factory/design.md");
        let provenance = include_str!("../assets/src/confirmation-console.png.json");
        let calendar_provenance = include_str!("../assets/src/editorial-calendar-texture.png.json");
        let original = include_bytes!("../assets/src/confirmation-console.png");
        let production = include_bytes!("../public/assets/confirmation-console.webp");
        let calendar_original = include_bytes!("../assets/src/editorial-calendar-texture.png");
        let calendar_production =
            include_bytes!("../public/assets/editorial-calendar-texture.webp");
        let paper_grain = include_bytes!("../public/assets/editorial-paper-grain.webp");
        let metadata: Value = serde_json::from_str(provenance).unwrap();
        let calendar_metadata: Value = serde_json::from_str(calendar_provenance).unwrap();

        assert!(app.contains("Generated artwork with recorded prompt provenance."));
        assert!(
            design.contains("Generated using the factory Azure image deployment on 2026-08-28.")
        );
        assert_eq!(metadata["deployment"], "factory-image");
        assert!(metadata["prompt"]
            .as_str()
            .unwrap()
            .contains("appointment confirmation instrument"));
        assert!(original.len() > production.len());
        assert!(production.len() > 10_000);
        assert!(design.contains("Generated with the factory image tool on 2026-08-29."));
        assert_eq!(calendar_metadata["deployment"], "factory-image");
        assert!(calendar_metadata["prompt"]
            .as_str()
            .unwrap()
            .contains("editorial still life"));
        assert!(calendar_original.len() > calendar_production.len());
        assert!(calendar_production.len() > 10_000);
        assert!(paper_grain.len() > 1_000);
    }

    #[tokio::test]
    async fn claim_anonymous_page_view_count() {
        let (state, path) = test_state().await;
        let app = build_app(state.clone());
        for _ in 0..2 {
            let request = Request::builder()
                .method("POST")
                .uri("/api/page-view")
                .header("x-forwarded-for", "203.0.113.42")
                .header("user-agent", "privacy-claim-fingerprint")
                .body(Body::empty())
                .unwrap();
            let response = app.clone().oneshot(request).await.unwrap();
            assert_eq!(response.status(), StatusCode::NO_CONTENT);
            assert!(response.headers().get(header::SET_COOKIE).is_none());
        }
        let rows: Vec<(String, i64)> = sqlx::query_as("SELECT day,count FROM page_counts")
            .fetch_all(&state.db)
            .await
            .unwrap();
        assert_eq!(rows, vec![(Utc::now().date_naive().to_string(), 2)]);
        let columns: Vec<String> =
            sqlx::query_scalar("SELECT name FROM pragma_table_info('page_counts') ORDER BY cid")
                .fetch_all(&state.db)
                .await
                .unwrap();
        assert_eq!(columns, vec!["day", "count"]);

        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn claim_service_storage_inventory() {
        let (state, path) = test_state().await;
        seed_test_settings(
            &state.db,
            Some((Utc::now() + ChronoDuration::days(365)).to_rfc3339()),
        )
        .await;
        let starts_at = (Utc::now() + ChronoDuration::days(3)).to_rfc3339();
        seed_requested_booking(&state.db, "storage-claim", &starts_at).await;
        let app = build_app(state.clone());
        let response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/page-view")
                    .header("x-forwarded-for", "storage-inventory")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NO_CONTENT);

        let settings: (String, String, String, Option<String>) = sqlx::query_as(
            "SELECT business_name,service_name,owner_oid,paid_until FROM settings WHERE id=1",
        )
        .fetch_one(&state.db)
        .await
        .unwrap();
        assert_eq!(settings.0, "Signal Studio");
        assert_eq!(settings.1, "Consultation");
        assert_eq!(settings.2, "test-owner");
        assert!(settings.3.is_some());

        let booking: (String, String, String, String) = sqlx::query_as(
            "SELECT guest_name,email,status,consent_at FROM bookings WHERE id='storage-claim'",
        )
        .fetch_one(&state.db)
        .await
        .unwrap();
        assert_eq!(booking.0, "Requested guest");
        assert_eq!(booking.1, "storage-claim@example.test");
        assert_eq!(booking.2, "requested");
        assert!(DateTime::parse_from_rfc3339(&booking.3).is_ok());
        let page_count: i64 = sqlx::query_scalar("SELECT count FROM page_counts")
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(page_count, 1);

        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn legacy_database_migrates_to_sociobot_owner_identity() {
        let path = std::env::temp_dir().join(format!(
            "guest-booking-confirm-upgrade-{}-{}.db",
            std::process::id(),
            random_token(12)
        ));
        let options = SqliteConnectOptions::from_str(&format!("sqlite:{}", path.display()))
            .unwrap()
            .create_if_missing(true)
            .foreign_keys(true)
            .journal_mode(SqliteJournalMode::Wal)
            .synchronous(SqliteSynchronous::Normal)
            .busy_timeout(Duration::from_secs(5));
        let db = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();
        sqlx::raw_sql(include_str!("../migrations/0001_init.sql"))
            .execute(&db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO settings(id,business_name,service_name,timezone,duration_minutes,weekly_hours,welcome_note,password_hash,created_at) VALUES(1,'Signal Studio','Consultation','UTC',30,'{}','','legacy-hash',?)")
            .bind(Utc::now().to_rfc3339())
            .execute(&db)
            .await
            .unwrap();

        sqlx::migrate!("./migrations").run(&db).await.unwrap();
        let owner_oid: Option<String> =
            sqlx::query_scalar("SELECT owner_oid FROM settings WHERE id=1")
                .fetch_one(&db)
                .await
                .unwrap();
        assert_eq!(owner_oid, None);
        let columns: Vec<String> =
            sqlx::query_scalar("SELECT name FROM pragma_table_info('settings')")
                .fetch_all(&db)
                .await
                .unwrap();
        assert!(!columns.iter().any(|column| column == "password_hash"));
        let sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='owner_sessions'",
        )
        .fetch_one(&db)
        .await
        .unwrap();
        assert_eq!(sessions, 0);

        db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn calendar_date_is_utc() {
        assert_eq!(
            ics_date(
                DateTime::parse_from_rfc3339("2026-08-28T12:30:00Z")
                    .unwrap()
                    .with_timezone(&Utc)
            ),
            "20260828T123000Z"
        );
    }

    #[test]
    fn rejects_inverted_or_malformed_weekly_hours() {
        let mut setup = SetupInput {
            business_name: "Signal Studio".into(),
            service_name: "Consultation".into(),
            timezone: "UTC".into(),
            duration_minutes: 30,
            weekly_hours: json!({"mon":["17:00","09:00"]}),
            welcome_note: String::new(),
        };
        let inverted = validate_setup(&setup).unwrap_err();
        assert_eq!(inverted.0, StatusCode::UNPROCESSABLE_ENTITY);
        assert_eq!(
            inverted.1,
            "Monday closing time must be later than opening time."
        );

        setup.weekly_hours = json!({"mon":["27:00","28:00"]});
        assert!(validate_setup(&setup).is_err());
        setup.weekly_hours = json!({"mon":["09:00"]});
        assert!(validate_setup(&setup).is_err());
    }

    #[tokio::test]
    async fn api_rejects_inverted_weekly_hours_with_a_recovery_message() {
        let (state, path) = test_state().await;
        let app = build_app(state.clone());
        let request = Request::builder()
            .method("POST")
            .uri("/api/owner/setup")
            .header(header::CONTENT_TYPE, "application/json")
            .header("x-test-oid", "test-owner")
            .body(Body::from(r#"{"business_name":"Signal Studio","service_name":"Consultation","timezone":"UTC","duration_minutes":30,"weekly_hours":{"mon":["17:00","09:00"]}}"#))
            .unwrap();
        let response = app.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let bytes = http_body_util::BodyExt::collect(response.into_body())
            .await
            .unwrap()
            .to_bytes();
        assert!(std::str::from_utf8(&bytes)
            .unwrap()
            .contains("Monday closing time must be later than opening time."));
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn claim_first_owner_setup_is_exclusive() {
        let (state, path) = test_state().await;
        let app = build_app(state.clone());
        let unauthenticated = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/owner/status")
                    .header("x-forwarded-for", "identity-unauthenticated")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(unauthenticated.status(), StatusCode::UNAUTHORIZED);

        let setup_body = r#"{"business_name":"Signal Studio","service_name":"Consultation","timezone":"UTC","duration_minutes":30,"weekly_hours":{"mon":["09:00","17:00"]}}"#;
        let setup = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/owner/setup")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header("x-forwarded-for", "identity-first-owner-setup")
                    .header("x-test-oid", "test-owner")
                    .body(Body::from(setup_body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(setup.status(), StatusCode::CREATED);
        let owner = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/owner/status")
                    .header("x-forwarded-for", "identity-owner")
                    .header("x-test-oid", "test-owner")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(owner.status(), StatusCode::OK);

        let other_owner = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/owner/status")
                    .header("x-forwarded-for", "identity-other")
                    .header("x-test-oid", "different-owner")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(other_owner.status(), StatusCode::FORBIDDEN);

        let takeover = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/owner/setup")
                    .header(header::CONTENT_TYPE, "application/json")
                    .header("x-forwarded-for", "identity-takeover")
                    .header("x-test-oid", "different-owner")
                    .body(Body::from(setup_body))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(takeover.status(), StatusCode::CONFLICT);
        let stored_owner: String = sqlx::query_scalar("SELECT owner_oid FROM settings WHERE id=1")
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(stored_owner, "test-owner");
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn api_rate_limit_counter_is_atomic_across_app_states() {
        let (state, path) = test_state().await;
        let now_ms = Utc::now().timestamp_millis();
        let mut requests = tokio::task::JoinSet::new();
        for _ in 0..41 {
            let db = state.db.clone();
            requests.spawn(async move {
                record_rate_limit(&db, "read:one-forwarded-client", now_ms, 40)
                    .await
                    .unwrap()
            });
        }
        let mut allowances = Vec::new();
        while let Some(value) = requests.join_next().await {
            allowances.push(value.unwrap());
        }
        assert_eq!(allowances.iter().filter(|allowed| **allowed).count(), 40);
        assert_eq!(allowances.iter().filter(|allowed| !**allowed).count(), 1);
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn api_rate_limit_does_not_reset_at_a_wall_clock_second_boundary() {
        let (state, path) = test_state().await;
        let key = "read:second-boundary-regression";
        for _ in 0..20 {
            assert!(record_rate_limit(&state.db, key, 999_900, 40)
                .await
                .unwrap());
        }
        for _ in 0..20 {
            assert!(record_rate_limit(&state.db, key, 1_000_100, 40)
                .await
                .unwrap());
        }

        let request_41 = record_rate_limit(&state.db, key, 1_000_101, 40)
            .await
            .unwrap();
        assert!(
            !request_41,
            "request 41 must be limited across a clock-second boundary"
        );

        let after_one_second = record_rate_limit(&state.db, key, 1_000_900, 40)
            .await
            .unwrap();
        assert!(
            after_one_second,
            "capacity must return when the oldest events expire"
        );

        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn concurrent_guest_confirmation_allows_exactly_one_success() {
        let (state, path) = test_state().await;
        let token = "a".repeat(40);
        let now = Utc::now().to_rfc3339();
        sqlx::query("INSERT INTO bookings(id,reference,guest_name,email,starts_at,timezone,duration_minutes,status,guest_token,guest_token_hash,consent_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)")
            .bind("booking-1")
            .bind("GBC-TEST")
            .bind("Ada Guest")
            .bind("ada@example.test")
            .bind((Utc::now() + ChronoDuration::days(2)).to_rfc3339())
            .bind("UTC")
            .bind(30_i64)
            .bind("awaiting_confirmation")
            .bind(&token)
            .bind(hash(&token))
            .bind(&now)
            .bind(&now)
            .bind(&now)
            .execute(&state.db)
            .await
            .unwrap();
        let app = build_app(state.clone());
        let first = app.clone().oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/guest/{token}/confirm"))
                .body(Body::empty())
                .unwrap(),
        );
        let second = app.oneshot(
            Request::builder()
                .method("POST")
                .uri(format!("/api/guest/{token}/confirm"))
                .body(Body::empty())
                .unwrap(),
        );
        let (first, second) = tokio::join!(first, second);
        let mut statuses = [first.unwrap().status(), second.unwrap().status()];
        statuses.sort();
        assert_eq!(statuses, [StatusCode::OK, StatusCode::CONFLICT]);
        let status: String = sqlx::query_scalar("SELECT status FROM bookings WHERE id='booking-1'")
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(status, "confirmed");
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn real_booking_actions_reschedule_calendar_reminder_and_cancel() {
        let (state, path) = test_state().await;
        seed_test_settings(&state.db, None).await;
        let initial_slot = test_slot(&state).await;
        let (_, Json(created)) = create_test_booking(&state, &initial_slot, 1).await.unwrap();
        let token = created["token"].as_str().unwrap().to_string();
        let initial_booking = booking_by_token(&state.db, &token).await.unwrap();
        let booking_id = initial_booking.id.clone();
        assert!(approve_booking(&state.db, &booking_id).await.unwrap());

        let reschedule_slot = public_slots(
            State(state.clone()),
            Query(SlotsQuery {
                from: None,
                days: Some(14),
            }),
        )
        .await
        .unwrap()
        .0["slots"]
            .as_array()
            .unwrap()
            .first()
            .unwrap()["start"]
            .as_str()
            .unwrap()
            .to_string();
        assert_ne!(reschedule_slot, initial_slot);

        let rescheduled = guest_reschedule(
            State(state.clone()),
            AxumPath(token.clone()),
            Json(RescheduleInput {
                starts_at: reschedule_slot.clone(),
            }),
        )
        .await
        .unwrap();
        assert_eq!(rescheduled.0["status"], "reschedule_requested");
        let changed_booking = booking_by_token(&state.db, &token).await.unwrap();
        assert_eq!(changed_booking.status, "reschedule_requested");
        assert_eq!(
            DateTime::parse_from_rfc3339(&changed_booking.starts_at).unwrap(),
            DateTime::parse_from_rfc3339(&reschedule_slot).unwrap()
        );

        assert!(approve_booking(&state.db, &booking_id).await.unwrap());
        assert_eq!(
            guest_confirm(State(state.clone()), AxumPath(token.clone()))
                .await
                .unwrap()
                .0["status"],
            "confirmed"
        );
        let calendar = guest_ics(State(state.clone()), AxumPath(token.clone()))
            .await
            .unwrap();
        assert_eq!(
            calendar
                .headers()
                .get(header::CONTENT_TYPE)
                .unwrap()
                .to_str()
                .unwrap(),
            "text/calendar; charset=utf-8"
        );
        assert_eq!(
            calendar
                .headers()
                .get(header::CONTENT_DISPOSITION)
                .unwrap()
                .to_str()
                .unwrap(),
            "attachment; filename=booking.ics"
        );
        let calendar_body = http_body_util::BodyExt::collect(calendar.into_body())
            .await
            .unwrap()
            .to_bytes();
        let calendar_text = std::str::from_utf8(&calendar_body).unwrap();
        assert!(calendar_text.contains("BEGIN:VCALENDAR"));
        assert!(calendar_text.contains("SUMMARY:Consultation — Signal Studio"));
        assert!(calendar_text.contains("STATUS:CONFIRMED"));

        let mut headers = HeaderMap::new();
        headers.insert("x-test-oid", HeaderValue::from_static("test-owner"));
        assert_eq!(
            owner_action(
                State(state.clone()),
                AxumPath((booking_id, "reminder".to_string())),
                headers,
            )
            .await
            .unwrap()
            .0["saved"],
            true
        );
        let reminded = booking_by_token(&state.db, &token).await.unwrap();
        assert_eq!(reminded.reminder_done, 1);
        assert!(reminded.reminder_done_at.is_some());

        assert_eq!(
            guest_cancel(State(state.clone()), AxumPath(token.clone()))
                .await
                .unwrap()
                .0["status"],
            "cancelled"
        );
        assert_eq!(
            booking_by_token(&state.db, &token).await.unwrap().status,
            "cancelled"
        );
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn concurrent_owner_approval_allows_one_slot_holder() {
        let (state, path) = test_state().await;
        let start = (Utc::now() + ChronoDuration::days(2)).to_rfc3339();
        seed_requested_booking(&state.db, "approval-one", &start).await;
        seed_requested_booking(&state.db, "approval-two", &start).await;
        let (first, second) = tokio::join!(
            approve_booking(&state.db, "approval-one"),
            approve_booking(&state.db, "approval-two")
        );
        assert_eq!(
            [first.unwrap(), second.unwrap()]
                .into_iter()
                .filter(|approved| *approved)
                .count(),
            1
        );
        let accepted: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM bookings WHERE starts_at=? AND status='awaiting_confirmation'",
        )
        .bind(start)
        .fetch_one(&state.db)
        .await
        .unwrap();
        assert_eq!(accepted, 1);
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn claim_free_desk_capacity_and_retention() {
        let (state, path) = test_state().await;
        seed_test_settings(&state.db, None).await;
        let slot = test_slot(&state).await;
        for number in 0..29 {
            assert_eq!(
                create_test_booking(&state, &slot, number).await.unwrap().0,
                StatusCode::CREATED
            );
        }
        let mut race = tokio::task::JoinSet::new();
        for number in 29..41 {
            let state = state.clone();
            let slot = slot.clone();
            race.spawn(async move { create_test_booking(&state, &slot, number).await });
        }
        let mut created = 0;
        let mut limited = 0;
        while let Some(result) = race.join_next().await {
            match result.unwrap() {
                Ok((StatusCode::CREATED, _)) => created += 1,
                Err(ApiError(StatusCode::CONFLICT, message))
                    if message.contains("free 30-booking limit") =>
                {
                    limited += 1
                }
                other => panic!("unexpected concurrent booking result: {other:?}"),
            }
        }
        assert_eq!((created, limited), (1, 11));
        let active: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM bookings WHERE status NOT IN ('cancelled','completed') AND starts_at > ?")
            .bind(Utc::now().to_rfc3339())
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(active, 30);

        seed_closed_booking(&state.db, "closed-31-days", 31).await;
        seed_closed_booking(&state.db, "closed-29-days", 29).await;
        cleanup(&state.db).await.unwrap();
        let remaining: Vec<String> =
            sqlx::query_scalar("SELECT id FROM bookings WHERE id LIKE 'closed-%' ORDER BY id")
                .fetch_all(&state.db)
                .await
                .unwrap();
        assert_eq!(remaining, vec!["closed-29-days"]);
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn claim_panel_pro_capacity_and_retention() {
        let (state, path) = test_state().await;
        seed_test_settings(
            &state.db,
            Some((Utc::now() + ChronoDuration::days(30)).to_rfc3339()),
        )
        .await;
        let slot = test_slot(&state).await;
        for number in 0..31 {
            assert_eq!(
                create_test_booking(&state, &slot, number).await.unwrap().0,
                StatusCode::CREATED
            );
        }
        seed_closed_booking(&state.db, "closed-364-days", 364).await;
        seed_closed_booking(&state.db, "closed-366-days", 366).await;
        cleanup(&state.db).await.unwrap();
        let remaining: Vec<String> =
            sqlx::query_scalar("SELECT id FROM bookings WHERE id LIKE 'closed-%' ORDER BY id")
                .fetch_all(&state.db)
                .await
                .unwrap();
        assert_eq!(remaining, vec!["closed-364-days"]);
        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }

    #[tokio::test]
    async fn claim_revoked_license_returns_to_free_limits_and_keeps_export() {
        let (state, path) = test_state().await;
        seed_test_settings(
            &state.db,
            Some((Utc::now() + ChronoDuration::days(30)).to_rfc3339()),
        )
        .await;
        let start = (Utc::now() + ChronoDuration::days(2)).to_rfc3339();
        let id = "revoked-export";
        let token = format!("{id}{}", "x".repeat(40));
        seed_requested_booking(&state.db, id, &start).await;
        sqlx::query("UPDATE bookings SET status='confirmed' WHERE id=?")
            .bind(id)
            .execute(&state.db)
            .await
            .unwrap();

        assert!(is_paid(&get_settings(&state.db).await.unwrap().unwrap()));
        apply_license_verdict(&state.db, &json!({"valid":false,"reason":"revoked"}))
            .await
            .unwrap();
        assert!(!is_paid(&get_settings(&state.db).await.unwrap().unwrap()));
        let retained: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM bookings WHERE id=?")
            .bind(id)
            .fetch_one(&state.db)
            .await
            .unwrap();
        assert_eq!(retained, 1);
        let calendar = guest_ics(State(state.clone()), AxumPath(token))
            .await
            .unwrap();
        assert_eq!(calendar.status(), StatusCode::OK);
        assert_eq!(
            calendar.headers().get(header::CONTENT_TYPE).unwrap(),
            "text/calendar; charset=utf-8"
        );

        state.db.close().await;
        std::fs::remove_file(path).unwrap();
    }
}
