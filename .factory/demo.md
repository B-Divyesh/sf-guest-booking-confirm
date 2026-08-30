# Demo sandbox

Open `/?demo=1` or use **Try it with sample data** on the first screen. `/demo` remains a compatible direct route. The demo starts with Maya Chen's realistic Northstar Barber appointment already approved, so the guest confirmation step is ready to try immediately. It safely demonstrates confirmation, a calendar download, another-time request, cancellation, and the owner's manual reminder checklist.

The demo stores its state only in `localStorage` under `demo:guest-booking-confirm:state`. It does not call a booking API, read an owner desk, or write to the SQLite database. **Reset demo** restores the approved sample. **Start for real** removes the demo key and returns to the real desk.
