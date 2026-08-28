import './styles.css';
import { escapeHtml as e, formatDate, safeTimezone, statusMeta, type BookingStatus } from './utils';

type Settings = { configured: boolean; business_name?: string; service_name?: string; timezone?: string; duration_minutes?: number; weekly_hours?: Hours; welcome_note?: string; paid?: boolean };
type Hours = Record<string, [string, string] | null>;
type Slot = { start: string; local: string; date: string };
type Booking = { id: string; reference: string; guest_name: string; email?: string; phone?: string; starts_at: string; timezone: string; duration_minutes: number; status: BookingStatus; guest_token?: string; reminder_done?: number; reminder_done_at?: string; updated_at: string };

const app = document.querySelector<HTMLDivElement>('#app')!;
const OWNER_TOKEN = 'gbc_owner_session';
const LICENSE_KEY = 'sb_license:guest-booking-confirm';
let ownerToken = sessionStorage.getItem(OWNER_TOKEN) || '';

class HttpError extends Error { constructor(message: string, public status: number) { super(message); } }
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (ownerToken) headers.set('authorization', `Bearer ${ownerToken}`);
  let response: Response;
  try { response = await fetch(`/api${url}`, { ...options, headers }); }
  catch { throw new HttpError('The booking desk is offline. Check your connection and try again.', 0); }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(body.error || 'Something went wrong. Try again.', response.status);
  return body as T;
}

function shell(content: string, owner = false): void {
  app.innerHTML = `<header class="topbar">
    <a class="wordmark" href="/" data-nav aria-label="Guest Booking Confirm home"><span class="brand-lamp" aria-hidden="true"></span><span>Guest Booking Confirm</span></a>
    <nav aria-label="Main navigation"><a href="${owner ? '/' : '/manage'}" data-nav>${owner ? 'Guest page' : 'Owner panel'}</a></nav>
  </header>${content}<footer><p>Clear appointment state, no guest account. Original generated artwork; no tracking cookies.</p><nav aria-label="Legal"><a href="/privacy" data-nav>Privacy</a><a href="/terms" data-nav>Terms</a></nav></footer>`;
  document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach(link => link.addEventListener('click', event => { if (link.origin === location.origin) { event.preventDefault(); history.pushState({}, '', link.href); route(); } }));
}

function loading(label = 'Checking the signal…'): void { shell(`<main id="main" class="center-page"><div class="loading-panel"><span class="signal-lamp amber" aria-hidden="true"></span><p role="status">${e(label)}</p></div></main>`); }
function errorPage(message: string, retry = true): void { shell(`<main id="main" class="center-page"><section class="error-panel"><p class="eyebrow">Signal interrupted</p><h1>We couldn’t open the booking desk</h1><p>${e(message)}</p>${retry ? '<button class="primary" id="retry">Try again</button>' : '<a class="button primary" href="/">Return home</a>'}</section></main>`); document.querySelector('#retry')?.addEventListener('click', route); }
function message(target: Element, text: string, kind: 'error' | 'success' = 'error'): void { target.innerHTML = `<p class="form-message ${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${e(text)}</p>`; }
function setBusy(button: HTMLButtonElement, busy: boolean, text = 'Working…'): void { if (!button.dataset.label) button.dataset.label = button.textContent || ''; button.disabled = busy; button.textContent = busy ? text : button.dataset.label; }
function localBookingUrl(token: string): string { return `${location.origin}/b/${encodeURIComponent(token)}`; }

async function route(): Promise<void> {
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  const path = location.pathname;
  document.title = path === '/manage' ? 'Owner panel — Guest Booking Confirm' : path === '/privacy' ? 'Privacy — Guest Booking Confirm' : path === '/terms' ? 'Terms — Guest Booking Confirm' : 'Guest Booking Confirm — clear appointment status';
  if (path === '/manage') return ownerPage();
  if (path === '/privacy') return privacyPage();
  if (path === '/terms') return termsPage();
  const guest = path.match(/^\/b\/([^/]+)$/);
  if (guest) return guestPage(decodeURIComponent(guest[1]));
  if (path !== '/') { history.replaceState({}, '', '/'); }
  return bookingPage();
}

async function bookingPage(): Promise<void> {
  loading('Opening the appointment desk…');
  try {
    const settings = await api<Settings>('/public/settings');
    if (!settings.configured) {
      shell(`<main id="main" class="center-page"><section class="not-ready"><div class="instrument-icon" aria-hidden="true"><i></i><i></i><i></i></div><p class="eyebrow">Desk not yet calibrated</p><h1>This booking page is nearly ready</h1><p>The owner still needs to set service hours. If that’s you, open the owner panel to finish setup.</p><a class="button primary" href="/manage" data-nav>Set up the owner panel</a></section></main>`);
      return;
    }
    let slots: Slot[] = [];
    try { slots = (await api<{ slots: Slot[] }>('/public/slots?days=14')).slots; } catch { /* rendered as recoverable empty state */ }
    shell(`<main id="main">
      <section class="booking-hero">
        <div class="hero-copy"><p class="eyebrow">${e(settings.business_name)} · guest booking</p><h1>Ask for a time.<br><em>Know where it stands.</em></h1><p class="lede">${e(settings.welcome_note || `Request ${settings.service_name}. No account, no unclear maybes—just one private link from request to confirmation.`)}</p>
        <ol class="mini-rail" aria-label="How booking works"><li><span>1</span>Request</li><li><span>2</span>Owner approves</li><li><span>3</span>You confirm</li></ol></div>
        <figure class="hero-art"><picture><source type="image/webp" srcset="/assets/confirmation-console.webp"><img src="/assets/confirmation-console-fallback.svg" width="768" height="512" alt="Illustrated mid-century appointment console with one coral confirmation lamp glowing" fetchpriority="high" decoding="async"></picture><figcaption>One visible signal for each booking state.</figcaption></figure>
      </section>
      <section class="request-layout" aria-labelledby="request-heading">
        <div class="request-intro"><p class="dial-number">01</p><h2 id="request-heading">Request ${e(settings.service_name)}</h2><p>Times appear in <strong>${e(settings.timezone)}</strong>. The owner must approve your request before it is booked.</p><div class="privacy-note"><span aria-hidden="true">◉</span><p>We keep only your booking contact details. Closed free-plan records are deleted after 30 days.</p></div></div>
        <form id="booking-form" novalidate>
          <fieldset><legend>Choose an available time</legend><div id="slots" class="slot-groups">${renderSlots(slots, settings.timezone!)}</div></fieldset>
          <div class="field-grid"><label>Full name <span>Required</span><input name="guest_name" autocomplete="name" required minlength="2" maxlength="80"></label><label>Email <span>Required</span><input name="email" type="email" inputmode="email" autocomplete="email" required maxlength="254"></label></div>
          <label>Phone <span>Optional, for your owner’s manual reminder</span><input name="phone" type="tel" autocomplete="tel" maxlength="30"></label>
          <label class="check"><input name="consent" type="checkbox" required><span>I agree that ${e(settings.business_name)} may store these details to manage this booking. I can cancel with my private link.</span></label>
          <div id="booking-message"></div><button class="primary big" type="submit">Send time request <span aria-hidden="true">→</span></button>
          <p class="button-note">This sends a request, not a confirmed appointment.</p>
        </form>
      </section>
    </main>`, false);
    bindBookingForm(settings);
    fetch('/api/page-view', { method: 'POST', keepalive: true }).catch(() => {});
  } catch (error) { errorPage(error instanceof Error ? error.message : 'Unknown error'); }
}

function renderSlots(slots: Slot[], timezone: string): string {
  if (!slots.length) return `<div class="empty-slots"><span class="signal-lamp off" aria-hidden="true"></span><p><strong>No open signals in the next 14 days.</strong><br>Contact the business directly or check again later.</p><button type="button" class="secondary" id="reload-slots">Check again</button></div>`;
  const days = new Map<string, Slot[]>(); slots.forEach(slot => days.set(slot.date, [...(days.get(slot.date) || []), slot]));
  return [...days.entries()].slice(0, 10).map(([date, daySlots], index) => `<div class="slot-day"><h3>${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: timezone }).format(new Date(`${date}T12:00:00Z`))}</h3><div>${daySlots.map((slot, i) => `<label class="slot"><input type="radio" name="starts_at" value="${e(slot.start)}" ${index === 0 && i === 0 ? 'required' : ''}><span>${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(slot.start))}</span></label>`).join('')}</div></div>`).join('');
}

function bindBookingForm(settings: Settings): void {
  document.querySelector('#reload-slots')?.addEventListener('click', bookingPage);
  const form = document.querySelector<HTMLFormElement>('#booking-form')!;
  form.addEventListener('submit', async event => {
    event.preventDefault(); const output = document.querySelector('#booking-message')!;
    if (!form.reportValidity()) { message(output, 'Complete the required fields and choose a time.'); return; }
    const data = new FormData(form); const button = form.querySelector<HTMLButtonElement>('button[type=submit]')!; setBusy(button, true, 'Sending request…');
    try {
      const result = await api<{ token: string; reference: string }>('/bookings', { method: 'POST', body: JSON.stringify({ guest_name: data.get('guest_name'), email: data.get('email'), phone: data.get('phone') || null, starts_at: data.get('starts_at'), consent: data.get('consent') === 'on' }) });
      history.pushState({}, '', `/b/${encodeURIComponent(result.token)}`); await guestPage(result.token, true);
    } catch (error) { message(output, error instanceof Error ? error.message : 'Could not send request.'); setBusy(button, false); }
  });
}

async function guestPage(token: string, justCreated = false): Promise<void> {
  loading('Reading your private booking link…');
  try {
    const data = await api<{ booking: Booking; business_name: string; service_name: string }>(`/guest/${encodeURIComponent(token)}`);
    const b = data.booking; const meta = statusMeta[b.status];
    let actions = '';
    if (b.status === 'awaiting_confirmation') actions = `<button class="primary" data-action="confirm">Confirm this time</button><button class="secondary" data-action="reschedule-open">Request another time</button><button class="text-danger" data-action="cancel-open">Cancel request</button>`;
    else if (b.status === 'confirmed') actions = `<a class="button primary" href="/api/guest/${encodeURIComponent(token)}/calendar.ics" download>Add to calendar (.ics)</a><button class="secondary" data-action="reschedule-open">Request another time</button><button class="text-danger" data-action="cancel-open">Cancel booking</button>`;
    else if (!['cancelled','completed','reschedule_requested'].includes(b.status)) actions = `<button class="secondary" data-action="reschedule-open">Request another time</button><button class="text-danger" data-action="cancel-open">Cancel request</button>`;
    shell(`<main id="main" class="guest-page">
      <section class="state-console state-${e(b.status)}">
        <div class="state-heading"><p class="eyebrow">Private booking signal · ${e(b.reference)}</p><h1>${e(meta.label)}</h1><p>${e(meta.note)}</p></div>
        <div class="big-lamp ${b.status === 'cancelled' ? 'red' : b.status === 'confirmed' || b.status === 'completed' ? 'green' : 'amber'}" aria-hidden="true"><i></i></div>
      </section>
      ${justCreated ? '<div class="notice success" role="status"><strong>Request sent.</strong> Bookmark this private page. It is your no-login route back to this booking.</div>' : ''}
      <section class="booking-ticket" aria-labelledby="details-title"><div><p class="ticket-label">Appointment card</p><h2 id="details-title">${e(data.service_name)}</h2><dl><div><dt>Guest</dt><dd>${e(b.guest_name)}</dd></div><div><dt>Time</dt><dd>${e(formatDate(b.starts_at, b.timezone))}</dd></div><div><dt>Duration</dt><dd>${e(b.duration_minutes)} minutes</dd></div><div><dt>With</dt><dd>${e(data.business_name)}</dd></div></dl></div><div class="ticket-ref"><span>Reference</span><strong>${e(b.reference)}</strong></div></section>
      <section class="signal-rail" aria-labelledby="trail-title"><div class="section-heading"><p class="dial-number">02</p><h2 id="trail-title">Confirmation trail</h2></div><ol>${trail(b)}</ol></section>
      <section class="guest-actions" aria-labelledby="actions-title"><h2 id="actions-title">Manage this booking</h2><div class="action-row">${actions || '<p>No more action is needed on this closed booking.</p>'}</div><div id="guest-panel"></div><div id="guest-message"></div><p class="private-warning">Keep this page private. Anyone with its address can change the booking.</p></section>
    </main>`);
    bindGuestActions(token, b);
  } catch (error) { errorPage(error instanceof Error ? error.message : 'Could not find this booking.', false); }
}

function trail(b: Booking): string {
  const step = statusMeta[b.status].step; const cancelled = b.status === 'cancelled';
  const items = [
    ['Request received', 'Your details and preferred time reached the owner.'],
    ['Owner approved', 'The requested time is being held for your confirmation.'],
    ['Guest confirmed', 'The appointment is agreed by both sides.'],
    ['Reminder checked', 'The owner can mark a manual reminder as sent.']
  ];
  return items.map((item, index) => `<li class="${index < step ? 'done' : index === step ? 'current' : ''}"><span aria-hidden="true">${index < step ? '✓' : index + 1}</span><div><strong>${e(item[0])}</strong><p>${e(item[1])}</p></div></li>`).join('') + (cancelled ? '<li class="cancel-step"><span aria-hidden="true">×</span><div><strong>Booking cancelled</strong><p>This trail is closed.</p></div></li>' : '');
}

function bindGuestActions(token: string, booking: Booking): void {
  const panel = document.querySelector('#guest-panel')!; const output = document.querySelector('#guest-message')!;
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.addEventListener('click', async () => {
    const action = button.dataset.action!;
    if (action === 'cancel-open') { panel.innerHTML = `<div class="inline-confirm"><p><strong>Cancel ${e(booking.reference)}?</strong> This releases the time and cannot be undone from this link.</p><button class="danger" id="cancel-confirm">Yes, cancel booking</button><button class="secondary" id="cancel-back">Keep booking</button></div>`; document.querySelector('#cancel-back')?.addEventListener('click', () => panel.innerHTML = ''); document.querySelector<HTMLButtonElement>('#cancel-confirm')?.addEventListener('click', async event => runGuestAction(event.currentTarget as HTMLButtonElement, token, 'cancel', output)); }
    else if (action === 'reschedule-open') {
      panel.innerHTML = '<div class="loading-inline" role="status">Finding open times…</div>';
      try { const data = await api<{ slots: Slot[]; timezone: string }>('/public/slots?days=14'); panel.innerHTML = `<form id="reschedule-form" class="reschedule"><h3>Choose a new time to request</h3><div class="compact-slots">${renderSlots(data.slots, data.timezone)}</div><button class="primary" type="submit">Send new time request</button><button class="secondary" type="button" id="reschedule-back">Keep current time</button></form>`; document.querySelector('#reschedule-back')?.addEventListener('click', () => panel.innerHTML=''); document.querySelector<HTMLFormElement>('#reschedule-form')?.addEventListener('submit', async event => { event.preventDefault(); const form=event.currentTarget as HTMLFormElement; if(!form.reportValidity()) return; const start=new FormData(form).get('starts_at'); const submit=form.querySelector<HTMLButtonElement>('button[type=submit]')!; setBusy(submit,true,'Sending…'); try{await api(`/guest/${encodeURIComponent(token)}/reschedule`,{method:'POST',body:JSON.stringify({starts_at:start})}); await guestPage(token);}catch(err){message(output,err instanceof Error?err.message:'Could not request that time.');setBusy(submit,false);} }); }
      catch (err) { panel.innerHTML = `<p class="form-message error" role="alert">${e(err instanceof Error ? err.message : 'Could not load times.')}</p>`; }
    } else await runGuestAction(button, token, action, output);
  }));
}

async function runGuestAction(button: HTMLButtonElement, token: string, action: string, output: Element): Promise<void> { setBusy(button,true,action==='confirm'?'Confirming…':'Cancelling…'); try{await api(`/guest/${encodeURIComponent(token)}/${action}`,{method:'POST'});await guestPage(token);}catch(err){message(output,err instanceof Error?err.message:'Could not update this booking.');setBusy(button,false);} }

async function ownerPage(): Promise<void> {
  loading('Opening the owner panel…');
  try {
    const { configured } = await api<{ configured: boolean }>('/owner/status');
    if (!configured) return ownerSetup();
    if (!ownerToken) return ownerLogin();
    try { await ownerDashboard(); } catch (error) { if (error instanceof HttpError && error.status === 401) { ownerToken=''; sessionStorage.removeItem(OWNER_TOKEN); ownerLogin('Your session ended. Sign in again.'); } else throw error; }
  } catch (error) { errorPage(error instanceof Error ? error.message : 'Could not open owner panel.'); }
}

function ownerSetup(): void {
  const defaultHours: Hours = { mon:['09:00','17:00'],tue:['09:00','17:00'],wed:['09:00','17:00'],thu:['09:00','17:00'],fri:['09:00','17:00'],sat:null,sun:null };
  shell(`<main id="main" class="owner-auth"><section><p class="eyebrow">First-run calibration</p><h1>Set up your booking desk</h1><p>Choose the service and hours guests may request. You can change these later.</p><form id="setup-form"><label>Business name<input name="business_name" required minlength="2" maxlength="80" autocomplete="organization"></label><label>Service name<input name="service_name" required minlength="2" maxlength="80" value="One-to-one appointment"></label><div class="field-grid"><label>Appointment length<select name="duration_minutes"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></label><label>Business timezone<input name="timezone" required value="${e(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}"></label></div><label>Welcome note <span>Optional</span><textarea name="welcome_note" maxlength="240" rows="3"></textarea></label>${hoursEditor(defaultHours)}<label>Owner password <span>At least 10 characters</span><input name="password" type="password" required minlength="10" autocomplete="new-password"></label><div id="owner-message"></div><button class="primary big" type="submit">Open my booking desk</button></form></section></main>`,true);
  document.querySelector<HTMLFormElement>('#setup-form')!.addEventListener('submit', async event => { event.preventDefault(); const form=event.currentTarget as HTMLFormElement; if(!form.reportValidity())return; const data=new FormData(form); const tz=String(data.get('timezone')); const output=document.querySelector('#owner-message')!; if(!safeTimezone(tz)){message(output,'Use an IANA timezone such as Europe/London or Asia/Kolkata.');return;} const button=form.querySelector<HTMLButtonElement>('button[type=submit]')!;setBusy(button,true,'Calibrating…');try{const result=await api<{token:string}>('/owner/setup',{method:'POST',body:JSON.stringify({...formSettings(data),password:data.get('password')})});ownerToken=result.token;sessionStorage.setItem(OWNER_TOKEN,ownerToken);await ownerDashboard();}catch(err){message(output,err instanceof Error?err.message:'Could not finish setup.');setBusy(button,false);} });
}

function hoursEditor(hours: Hours): string { const names:Record<string,string>={mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday'};return `<fieldset class="hours"><legend>Request hours</legend>${Object.entries(names).map(([key,name])=>{const range=hours[key];return `<div><label class="day-toggle"><input type="checkbox" name="${key}_open" ${range?'checked':''}><span>${name}</span></label><input type="time" name="${key}_start" value="${range?.[0]||'09:00'}" aria-label="${name} opens"><span>to</span><input type="time" name="${key}_end" value="${range?.[1]||'17:00'}" aria-label="${name} closes"></div>`}).join('')}</fieldset>`; }
function formSettings(data: FormData): object { const keys=['mon','tue','wed','thu','fri','sat','sun'];const weekly_hours:Object=Object.fromEntries(keys.map(k=>[k,data.get(`${k}_open`)?[data.get(`${k}_start`),data.get(`${k}_end`)]:null]));return{business_name:data.get('business_name'),service_name:data.get('service_name'),duration_minutes:Number(data.get('duration_minutes')),timezone:data.get('timezone'),welcome_note:data.get('welcome_note'),weekly_hours}; }

function ownerLogin(note = ''): void { shell(`<main id="main" class="owner-auth"><section><div class="instrument-icon" aria-hidden="true"><i class="on"></i><i></i><i></i></div><p class="eyebrow">Owner access</p><h1>Open the control panel</h1><p>Your guests never sign in. This password is only for the business owner.</p><form id="login-form"><label>Owner password<input name="password" type="password" minlength="10" required autofocus autocomplete="current-password"></label><div id="owner-message">${note?`<p class="form-message error">${e(note)}</p>`:''}</div><button class="primary big" type="submit">Sign in</button></form></section></main>`,true); document.querySelector<HTMLFormElement>('#login-form')!.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget as HTMLFormElement;const button=form.querySelector<HTMLButtonElement>('button')!;const output=document.querySelector('#owner-message')!;setBusy(button,true,'Checking…');try{const result=await api<{token:string}>('/owner/login',{method:'POST',body:JSON.stringify({password:new FormData(form).get('password')})});ownerToken=result.token;sessionStorage.setItem(OWNER_TOKEN,ownerToken);await ownerDashboard();}catch(err){message(output,err instanceof Error?err.message:'Could not sign in.');setBusy(button,false);}}); }

async function ownerDashboard(): Promise<void> {
  const [settings,data]=await Promise.all([api<Settings>('/owner/settings'),api<{bookings:Booking[]}>('/owner/bookings')]); const bookings=data.bookings; const active=bookings.filter(b=>!['cancelled','completed'].includes(b.status)); const confirmed=active.filter(b=>b.status==='confirmed'); const reminders=active.filter(b=>['confirmed','awaiting_confirmation'].includes(b.status)&&!b.reminder_done);
  shell(`<main id="main" class="owner-main"><section class="owner-heading"><div><p class="eyebrow">${e(settings.business_name)} · control panel</p><h1>Booking signals</h1><p>Approve requests, share each private link, and record manual reminders.</p></div><div class="owner-actions"><button class="secondary" id="copy-public">Copy guest page</button><button class="secondary" id="owner-settings">Desk settings</button><button class="quiet" id="logout">Sign out</button></div></section>
    <section class="meters" aria-label="Booking summary"><div><span>Active</span><strong>${active.length}</strong><small>${settings.paid?'Unlimited plan':'of 30 free'}</small></div><div><span>Confirmed</span><strong>${confirmed.length}</strong><small>both sides agreed</small></div><div><span>Reminders due</span><strong>${reminders.length}</strong><small>manual checklist</small></div></section>
    <section class="owner-list" aria-labelledby="queue-title"><div class="section-heading"><p class="dial-number">03</p><div><h2 id="queue-title">Appointment queue</h2><p>Shown in each booking’s business timezone.</p></div><div class="filters" role="group" aria-label="Filter bookings"><button class="filter active" data-filter="active">Active</button><button class="filter" data-filter="all">All</button></div></div><div id="booking-list">${renderOwnerBookings(active)}</div><div id="dashboard-message"></div></section>
    <section class="plan-panel"><div><p class="eyebrow">Calendar capacity</p><h2>${settings.paid?'Panel Pro is active':'Free desk · 30 active bookings'}</h2><p>${settings.paid?'Unlimited active bookings and 365-day closed-record retention are unlocked.':'The free desk includes the complete guest confirmation trail. Panel Pro adds unlimited active bookings and 365-day closed-record retention.'}</p></div>${settings.paid?'<span class="paid-stamp">Licensed</span>':'<div class="plan-actions"><a class="button primary" href="https://api.sociobot.in/api/v1/products/guest-booking-confirm/checkout">Buy Panel Pro · $29</a><button class="secondary" id="restore-license">Restore a license</button><small>$29 one-time purchase. Sociobot/Dodo is merchant of record; refunds are handled there.</small></div>'}<div id="license-panel"></div></section>
  </main>`,true);
  bindDashboard(bookings,active,settings);
  consumeLicenseFromUrl();
}

function renderOwnerBookings(bookings: Booking[]): string { if(!bookings.length)return `<div class="empty-queue"><div class="instrument-icon" aria-hidden="true"><i></i><i></i><i></i></div><h3>No booking signals yet</h3><p>Share your guest page. New requests will arrive here for approval.</p><button class="primary" id="empty-copy">Copy guest page</button></div>`;return bookings.map(b=>{const meta=statusMeta[b.status];const guestUrl=b.guest_token?localBookingUrl(b.guest_token):'';let buttons='';if(['requested','reschedule_requested'].includes(b.status))buttons+=`<button class="primary small" data-owner="approve" data-id="${e(b.id)}">Approve time</button>`;if(['awaiting_confirmation','confirmed'].includes(b.status)){buttons+=`<button class="secondary small" data-copy="${e(guestUrl)}">Copy guest link</button><button class="${b.reminder_done?'quiet':'secondary'} small" data-owner="${b.reminder_done?'unremind':'reminder'}" data-id="${e(b.id)}">${b.reminder_done?'Undo reminder':'Mark reminder sent'}</button>`;}if(b.status==='confirmed')buttons+=`<button class="quiet small" data-owner="complete" data-id="${e(b.id)}">Mark complete</button>`;if(!['cancelled','completed'].includes(b.status))buttons+=`<button class="text-danger small" data-owner="cancel" data-id="${e(b.id)}">Cancel</button>`;return `<article class="owner-booking"><div class="booking-state"><span class="signal-lamp ${b.status==='confirmed'?'green':b.status==='cancelled'?'red':'amber'}" aria-hidden="true"></span><div><strong>${e(meta.label)}</strong><small>${e(b.reference)}</small></div></div><div class="booking-when"><strong>${e(formatDate(b.starts_at,b.timezone))}</strong><span>${e(b.duration_minutes)} min · ${e(b.timezone)}</span></div><div class="booking-person"><strong>${e(b.guest_name)}</strong><a href="mailto:${encodeURIComponent(b.email||'')}">${e(b.email)}</a>${b.phone?`<a href="tel:${e(b.phone)}">${e(b.phone)}</a>`:''}</div><div class="booking-actions">${buttons}</div>${b.reminder_done_at?`<p class="reminder-stamp">✓ Reminder recorded ${e(formatDate(b.reminder_done_at,b.timezone,false))}</p>`:''}</article>`}).join(''); }

function bindDashboard(all:Booking[],active:Booking[],settings:Settings):void { const copy=async(value:string,button?:HTMLButtonElement)=>{try{await navigator.clipboard.writeText(value);if(button){const old=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=old,1400);}}catch{prompt('Copy this link:',value);}};document.querySelector('#copy-public')?.addEventListener('click',event=>copy(location.origin,(event.currentTarget as HTMLButtonElement)));document.querySelector('#empty-copy')?.addEventListener('click',event=>copy(location.origin,(event.currentTarget as HTMLButtonElement)));document.querySelector('#logout')?.addEventListener('click',()=>{ownerToken='';sessionStorage.removeItem(OWNER_TOKEN);ownerLogin();});document.querySelector('#owner-settings')?.addEventListener('click',()=>showSettings(settings));document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button=>button.addEventListener('click',()=>copy(button.dataset.copy!,button)));document.querySelectorAll<HTMLButtonElement>('[data-owner]').forEach(button=>button.addEventListener('click',async()=>{if(button.dataset.owner==='cancel'&&!confirm(`Cancel this booking? The guest link will immediately show “Cancelled”.`))return;setBusy(button,true,'Saving…');try{await api(`/owner/bookings/${encodeURIComponent(button.dataset.id!)}/${button.dataset.owner}`,{method:'PATCH'});await ownerDashboard();}catch(err){message(document.querySelector('#dashboard-message')!,err instanceof Error?err.message:'Could not update booking.');setBusy(button,false);}}));document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));button.classList.add('active');document.querySelector('#booking-list')!.innerHTML=renderOwnerBookings(button.dataset.filter==='all'?all:active);bindDashboardListOnly();}));document.querySelector('#restore-license')?.addEventListener('click',showLicenseRestore); }
function bindDashboardListOnly():void { document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button=>button.addEventListener('click',()=>navigator.clipboard.writeText(button.dataset.copy!)));document.querySelectorAll<HTMLButtonElement>('[data-owner]').forEach(button=>button.addEventListener('click',async()=>{try{await api(`/owner/bookings/${encodeURIComponent(button.dataset.id!)}/${button.dataset.owner}`,{method:'PATCH'});await ownerDashboard();}catch(err){alert(err instanceof Error?err.message:'Could not update.');}})); }

function showSettings(settings:Settings):void { const main=document.querySelector('.owner-main')!;main.insertAdjacentHTML('afterbegin',`<section class="settings-drawer" aria-labelledby="settings-title" tabindex="-1"><div class="drawer-head"><h2 id="settings-title">Desk settings</h2><button class="quiet" id="close-settings">Close</button></div><form id="settings-form"><label>Business name<input name="business_name" value="${e(settings.business_name)}" required minlength="2"></label><label>Service name<input name="service_name" value="${e(settings.service_name)}" required minlength="2"></label><div class="field-grid"><label>Appointment length<select name="duration_minutes">${[30,45,60,90].map(n=>`<option value="${n}" ${n===settings.duration_minutes?'selected':''}>${n} minutes</option>`).join('')}</select></label><label>Business timezone<input name="timezone" value="${e(settings.timezone)}" required></label></div><label>Welcome note<textarea name="welcome_note" maxlength="240" rows="3">${e(settings.welcome_note)}</textarea></label>${hoursEditor(settings.weekly_hours||{})}<input type="hidden" name="password" value="unchanged-password"><div id="settings-message"></div><button class="primary" type="submit">Save desk settings</button></form></section>`);document.querySelector('#close-settings')?.addEventListener('click',()=>document.querySelector('.settings-drawer')?.remove());document.querySelector<HTMLFormElement>('#settings-form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget as HTMLFormElement;const data=new FormData(form);const output=document.querySelector('#settings-message')!;try{await api('/owner/settings',{method:'PATCH',body:JSON.stringify(formSettings(data))});await ownerDashboard();}catch(err){message(output,err instanceof Error?err.message:'Could not save settings.');}});document.querySelector<HTMLElement>('.settings-drawer')?.focus(); }

function consumeLicenseFromUrl():void { const url=new URL(location.href);const license=url.searchParams.get('license');if(license){localStorage.setItem(LICENSE_KEY,license);url.searchParams.delete('license');history.replaceState({},'',url);void submitLicense(license);}else{const cached=localStorage.getItem(LICENSE_KEY);const checked=Number(localStorage.getItem(`${LICENSE_KEY}:checked`)||0);if(cached&&Date.now()-checked>86400000)void submitLicense(cached,true);} }
function showLicenseRestore():void { const panel=document.querySelector('#license-panel')!;panel.innerHTML=`<form id="license-form" class="license-form"><label>License token<input name="license" autocomplete="off" required></label><button class="primary" type="submit">Verify license</button></form>`;document.querySelector<HTMLFormElement>('#license-form')!.addEventListener('submit',async event=>{event.preventDefault();const token=String(new FormData(event.currentTarget as HTMLFormElement).get('license'));localStorage.setItem(LICENSE_KEY,token);await submitLicense(token);}); }
async function submitLicense(license:string,quiet=false):Promise<void>{const panel=document.querySelector('#license-panel');try{const verdict=await api<{valid:boolean;reason:string}>('/license/verify',{method:'POST',body:JSON.stringify({license})});localStorage.setItem(`${LICENSE_KEY}:checked`,String(Date.now()));localStorage.setItem(`${LICENSE_KEY}:valid`,String(verdict.valid));if(verdict.valid){await ownerDashboard();}else if(panel&&!quiet){message(panel,`This license is not active (${verdict.reason}). Free features remain available.`);}}catch(err){if(panel&&!quiet)message(panel,err instanceof Error?err.message:'Could not verify the license.');}}

function privacyPage():void { shell(`<main id="main" class="legal"><p class="eyebrow">Plain-language policy · updated 28 August 2026</p><h1>Privacy</h1><p class="lede">This service stores only what a small business needs to manage an appointment.</p><h2>What is stored</h2><p>Your name, email, optional phone number, requested time, consent timestamp, booking state, and reminder checklist state. The service also stores a daily page-view count with no cookie, fingerprint, or IP address attached.</p><h2>Why and for how long</h2><p>The data exists to request, approve, confirm, change, and remember an appointment. On the free plan, closed booking records are deleted 30 days after the appointment. Panel Pro retains closed records for up to 365 days. Active future bookings remain until closed.</p><h2>Who can see it</h2><p>The business owner can see booking details. Anyone who has your unguessable private booking link can view and change that booking, so keep it private. We do not sell data or use it for advertising.</p><h2>Deletion and correction</h2><p>Use the private link to cancel, or contact the business shown on your booking page to request early deletion or correction. Hosting and checkout infrastructure may process network and transaction data under Sociobot/Dodo policies.</p><h2>Local storage</h2><p>The owner session is kept only for the browser tab session. A purchased license and its last verification result are stored locally in the owner’s browser so the free experience never waits on billing.</p></main>`); }
function termsPage():void { shell(`<main id="main" class="legal"><p class="eyebrow">Service terms · updated 28 August 2026</p><h1>Terms</h1><p class="lede">Guest Booking Confirm records appointment intent and state. It is not a payment, emergency, or medical scheduling service.</p><h2>Booking status</h2><p>A request is not booked until the owner approves it and the guest confirms it. The current wording on the private booking page is the authoritative state. Businesses remain responsible for delivering their service and contacting guests.</p><h2>Acceptable use</h2><p>Do not use the service for unlawful activity, emergencies, sensitive medical records, or unsolicited marketing. Enter only contact details needed for the appointment.</p><h2>Availability</h2><p>The software is provided as-is without a guarantee of uninterrupted availability. Export confirmed appointments to your own calendar and keep an appropriate operational backup.</p><h2>Panel Pro purchase</h2><p>Panel Pro is a $29 one-time license unlock sold through Sociobot, with Dodo acting in the merchant-of-record flow. The checkout confirms the price before purchase. Refunds are handled by the merchant; a refunded or revoked license returns the calendar to free limits without deleting active accessibility or export features.</p><h2>Liability</h2><p>To the extent allowed by law, the operator is not liable for missed appointments, lost business, or indirect damages. These terms do not remove rights that cannot legally be waived.</p></main>`); }

addEventListener('popstate', route);
addEventListener('online', () => document.body.classList.remove('offline'));
addEventListener('offline', () => document.body.classList.add('offline'));
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
route();
