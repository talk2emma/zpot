"""Plain-language rule lines (English; mobile localises from codes where it can)."""

DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def days_text(days):
    d = sorted(days)
    if d == list(range(7)):
        return "every day"
    if d == [0, 1, 2, 3, 4]:
        return "Mon–Fri"
    if d == [0, 1, 2, 3, 4, 5]:
        return "Mon–Sat"
    return ", ".join(DAY_NAMES[i] for i in d)


def hm(m):
    m = m % 1440 if m != 1440 else 1440
    return "24:00" if m == 1440 else f"{m // 60:02d}:{m % 60:02d}"


def window_text(w):
    if w.start_minute == 0 and w.end_minute == 1440:
        return f"{days_text(w.days)}, all day"
    return f"{days_text(w.days)} {hm(w.start_minute)}–{hm(w.end_minute)}"


def windows_text(obj):
    ws = list(obj.windows.all())
    return "; ".join(window_text(w) for w in ws) if ws else "at all times"


def rule_line(r):
    when = windows_text(r)
    if r.kind == "free":
        return f"Free parking permitted {when}."
    if r.kind == "paid":
        t = r.tariff
        return f"Paid {when} at €{t.rate_per_hour}/h (billed per {t.billing_increment_minutes} min)."
    if r.kind == "permit_only":
        return f"{r.permit_type.name} holders only, {when}. Visitors may not park."
    if r.kind == "badge_only":
        return f"Reserved for vehicles displaying a valid disabled parking badge, {when}."
    if r.kind == "max_stay":
        h = r.max_stay_minutes / 60
        return f"Maximum stay {h:g} hours ({when})."
    return r.label


def restriction_line(r):
    return f"No parking: {r.label} ({windows_text(r)})."


def validity_suffix(obj):
    if obj.valid_from and obj.valid_until:
        return f" Applies {obj.valid_from:%d %b %Y}–{obj.valid_until:%d %b %Y}."
    if obj.valid_from:
        return f" Starts {obj.valid_from:%d %b %Y}."
    if obj.valid_until:
        return f" Until {obj.valid_until:%d %b %Y}."
    return ""
