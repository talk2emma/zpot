#!/usr/bin/env python3
"""Generates the migration inventories + implementation-status.json from the read-only prototype.

Run: python3 scripts/tools/gen_migration_docs.py
Inputs : Interactive prototype (play me)-html/Main.dc.html (parsed, never modified)
Outputs: docs/migration/{screen-inventory,interaction-inventory,navigation-matrix,screen-to-api-matrix}.md,
         docs/implementation-status.json (merged with test results passed via env/args)
"""
import html
import json
import os
import re
import subprocess
from collections import defaultdict
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
PROTO = os.path.join(ROOT, "Interactive prototype (play me)-html", "Main.dc.html")
DOCS = os.path.join(ROOT, "docs")

# Status vocabulary (honest):
#   implemented        – built in RN and wired to the real API/device capability
#   partial            – built; some prototype behaviour deferred (noted)
#   routed-placeholder – entry point exists; destination is an explicit "coming in the next build" screen (Part 2)
#   not-started        – Part 2 / post-MVP; no RN code yet
#   dev-only           – prototype simulation control; intentionally not shipped
S = {}
def screen(key, sid, name, purpose, module, rn, phase, status, apis, tests, note="", inputs="", entry="", exit_=""):
    S[key] = dict(id=sid, key=key, name=name, purpose=purpose, module=module, rn=rn, phase=phase, status=status,
                  apis=apis, tests=tests, note=note, inputs=inputs, entry=entry, exit=exit_)

T_ON = "__tests__/onboarding.test.tsx"; T_AU = "__tests__/auth.test.tsx"; T_PK = "__tests__/parking.test.tsx"
screen("splash","SCR-001","Splash","Brand launch; restore session; route first-run vs returning","onboarding","screens/onboarding/SplashScreen.tsx","P1","implemented",[],"unit:"+T_ON,
       "Native splash (react-native-bootsplash) + JS splash; waits for prefs hydration + session restore.", entry="app launch", exit_="language (first run) | explore (returning)")
screen("language","SCR-002","Choose your language","Pick EN / PT-PT, live preview","onboarding","screens/onboarding/LanguageScreen.tsx","P1","implemented",["PATCH /users/me/preferences/ (signed in)"],"unit:"+T_ON,
       inputs="language radio", entry="splash; profile › language", exit_="welcome | back to profile")
screen("welcome","SCR-003","Welcome","Value proposition","onboarding","screens/onboarding/WelcomeScreen.tsx","P1","implemented",[],"manual",entry="language",exit_="locPerm | onboard")
screen("onboard","SCR-004","How Zpot works (3 steps)","Explain search → compare → navigate","onboarding","screens/onboarding/OnboardingScreen.tsx","P1","implemented",[],"unit:"+T_ON,entry="welcome",exit_="locPerm (next/skip)")
screen("locPerm","SCR-005","Location permission primer","Explain before OS prompt; manual fallback","onboarding","screens/onboarding/LocationPermissionScreen.tsx","P1","implemented",["device: location permission"],"unit:"+T_ON,
       "Prototype's simulated OS sheet (osLoc) replaced by the real OS prompt.",entry="welcome/onboard; explore 'Turn on location'",exit_="locOutcome | account | search")
screen("locOutcome","SCR-006","Location outcome","Explain precise/approx/denied/restricted/off/unavailable","onboarding","screens/onboarding/LocationOutcomeScreen.tsx","P1","implemented",["device: settings deep link"],"unit:"+T_ON,
       "'restricted' cannot be distinguished from 'denied' without an extra permissions library; reported as denied.",entry="locPerm",exit_="account | back")
screen("account","SCR-007","Account choice","Guest / sign in / create account","onboarding","screens/onboarding/AccountChoiceScreen.tsx","P1","implemented",[],"unit:"+T_ON,entry="locOutcome | locPerm",exit_="explore | signin | register")
screen("register","SCR-009","Create account","Email/password registration with terms","auth","screens/auth/RegisterScreen.tsx","P1","implemented",["POST /auth/register/"],"unit:"+T_AU+"; api:tests/test_auth.py",
       inputs="email, password, confirm, terms", entry="account; signin; profile; save-gated actions", exit_="verify")
screen("verify","SCR-010","Verify email","Pending / expired / done states, resend","auth","screens/auth/VerifyEmailScreen.tsx","P1","implemented",["POST /auth/verify-email/","POST /auth/resend-verification/","GET /users/me/"],"unit:"+T_AU+"; api",
       "Deep link zpot://verify-email?token=… + dev-only paste-token field.",entry="register; profile banner; deep link",exit_="back to journey")
screen("signin","SCR-008","Sign in","Email/password login, errors, forgot link","auth","screens/auth/SignInScreen.tsx","P1","implemented",["POST /auth/login/"],"unit:"+T_AU+"; api",inputs="email, password",entry="account; profile; register",exit_="pending journey | back")
screen("forgot","SCR-011","Reset password","Request link → (deep link) new password → done","auth","screens/auth/ForgotPasswordScreen.tsx","P1","implemented",["POST /auth/password-reset/","POST /auth/password-reset/confirm/"],"api:tests/test_auth.py; manual",
       inputs="email; new password",entry="signin; deep link zpot://reset-password",exit_="signin")
screen("legal","SCR-012","Legal & data sources","Terms / privacy / sources / disclaimer (draft)","support","screens/profile/SettingsScreens.tsx#LegalScreen","P1","implemented",[],"manual",entry="register links; profile",exit_="back")
screen("explore","SCR-013","Explore (map + results sheet)","Map, overlays, search bar, chips, controls, sheet, list view, selected spot","parking","screens/explore/ExploreScreen.tsx (+ExploreSheet, ResultsPanel, SelectedSpotPanel)","P1","implemented",
       ["GET /parking/options/","GET /parking/map-layers/","GET /parking/areas/{id}/","GET /places/reverse-geocode/"],"unit:"+T_PK+"; contract",
       "Map: MapLibre Native (Mapbox requires credentials not available). Community vacancy pins/voting (selVac) and 'Report' FAB route to Part 2. Sponsored ad card (monetisation concept) not shipped.",
       entry="tabs; search; plan; filters", exit_="search, plan, filters, details, navPick, layers, notifications(P2), report(P2)")
screen("search","SCR-014","Destination search","Autocomplete, recents, popular, current location, unsupported-city message","parking","screens/explore/SearchScreen.tsx","P1","implemented",["GET /places/autocomplete/"],"unit:"+T_PK+"; contract",inputs="query",entry="explore search bar",exit_="explore | plan")
screen("plan","SCR-015","When are you parking?","Arrival day/time, duration, walk, free-only, paid, permit","parking","screens/explore/PlanScreen.tsx (+forms/DateTimeSelector)","P1","implemented",["(feeds GET /parking/options/ params)"],"unit:__tests__/searchParams.test.tsx",
       inputs="day chips, hour stepper, duration stepper, walk chips, toggles, permit chips",entry="explore time chip; search plan row; no-free 'change time'",exit_="explore")
screen("filters","SCR-016","Filters","Free only, time-limited, paid, verified-only, accessible, walk, max cost","parking","screens/explore/FiltersScreen.tsx","P1","implemented",["GET /parking/options/ (live count)"],"unit:"+T_PK,entry="explore Filters chip",exit_="explore")
screen("details","SCR-017","Parking details","Status for stay, cost/limit/walk/availability, plain-language rules, verification, partner disclosure, actions","parking","screens/parking/ParkingDetailsScreen.tsx","P1","implemented",
       ["GET /parking/areas/{id}/"],"unit:"+T_PK+"; api",
       "Save / I parked here / Report are routed to Part 2 placeholders. Share uses the OS share sheet. Guidance-support form is Part 2.",entry="result card; selected spot; deep link zpot://parking/{id}",exit_="navPick, map, Part 2 entries")
screen("navPick","SCR-018","Navigate with","Choose Apple Maps / Google Maps / Waze / system","navigation","screens/parking/NavigationPickerScreen.tsx","P1","implemented",["device: Linking.canOpenURL/openURL"],"unit:"+T_PK,entry="details; selected spot",exit_="external app → navReturn")
screen("handoff","SCR-019","Simulated hand-off","Prototype stand-in for the external maps app","navigation","(real external app)","P1","implemented",[],"manual","Replaced by the real deep link to the maps app.",entry="navPick",exit_="navReturn")
screen("navReturn","SCR-020","Welcome back","Outcome after navigation (parked / no space / another / wrong info)","navigation","screens/parking/NavigationReturnScreen.tsx","P1","partial",["GET /parking/areas/{id}/"],"manual",
       "'I parked here' and 'information was wrong' route to Part 2 (sessions/reports).",entry="app returns to foreground after hand-off",exit_="explore | Part 2")
screen("partner","SCR-021","Partner reservation","Partner booking (monetisation concept)","monetisation","—","post-MVP","not-started",["(future) partner API"],"none","Partner offer + disclosure shown read-only on details; booking flow deferred.")
for key,sid,name in [("startSession","SCR-022","Start parking session"),("session","SCR-023","Active session"),("editSession","SCR-024","Edit session"),("endSession","SCR-025","End session"),("summary","SCR-026","Session summary")]:
    screen(key,sid,name,"Parking session lifecycle with reminders","sessions","Part2Screen(feature=session) → Part 2 SessionScreens","P2","routed-placeholder" if key=="startSession" else "not-started",
           ["POST/GET/PATCH /sessions/ (Part 2)"],"none","Entry points (details 'I parked here', navReturn) route to an explicit Part 2 screen.")
for key,sid,name in [("rType","SCR-027","Report type"),("rLoc","SCR-028","Report location"),("rDetails","SCR-029","Report details"),("rReview","SCR-030","Report review"),("rSuccess","SCR-031","Report submitted"),("myReports","SCR-032","My reports"),("reportDetail","SCR-033","Report detail & appeal")]:
    screen(key,sid,name,"Community reporting & review","community","Part2Screen(feature=report) → Part 2 ReportFlow","P2","routed-placeholder" if key=="rType" else "not-started",
           ["POST /reports/, GET /reports/mine/ (Part 2)"],"none")
screen("saved","SCR-034","Saved","Saved places + recent destinations","saved","screens/profile/TabScreens.tsx#SavedScreen","P2","partial",["(Part 2) /saved/"],"manual","Recent destinations implemented (device). Saved places sync is Part 2.")
screen("activity","SCR-035","Activity","Active session, stats, reports, past sessions","sessions","screens/profile/TabScreens.tsx#ActivityScreen","P2","partial",["(Part 2)"],"manual","Tab exists with honest Part 2 notice.")
screen("notifs","SCR-036","Notifications inbox","Reminders, rule changes, report updates","notifications","Part2Screen(feature=notifs)","P2","routed-placeholder",["(Part 2) /notifications/"],"none")
screen("nprefs","SCR-037","Notification preferences","Per-category toggles + permission state","notifications","screens/onboarding/NotificationsIntroScreen.tsx (explanation only)","P2","partial",["(Part 2)"],"manual","Contextual explanation implemented; no permission prompt at launch (by design).")
screen("profile","SCR-038","Profile","Account summary + settings hub","profile","screens/profile/ProfileScreen.tsx","P1","implemented",["GET /users/me/","POST /auth/logout/","GET /health/"],"manual",
       "Pro/commute/vehicles/insights/scout/Z-Trigger rows not shown (post-MVP/flagged).")
screen("acctMgmt","SCR-039","Account","Email, display name, delete","profile","screens/profile/SettingsScreens.tsx#AccountSettingsScreen","P1","implemented",["PATCH /users/me/"],"api:tests/test_auth.py")
screen("pprefs","SCR-040","Parking preferences","Walk, free default, paid alternatives, permit, badge","profile","screens/profile/SettingsScreens.tsx#ParkingPreferencesScreen","P1","implemented",["GET/PATCH /users/me/preferences/"],"api:tests/test_auth.py",
       "Local for guests; synced when signed in.")
screen("privacy","SCR-041","Privacy & permissions","Location state, personalisation, analytics, delete","privacy","screens/profile/SettingsScreens.tsx#PrivacyScreen","P1","partial",["GET/PATCH /users/me/preferences/"],"manual",
       "Data export request and personalised ads are Part 2/post-MVP.")
screen("help","SCR-042","Help","FAQ","support","screens/profile/SettingsScreens.tsx#HelpScreen","P1","implemented",[],"manual")
screen("support","SCR-043","Contact support / guidance problem","Support ticket form","support","—","P2","not-started",["POST /support/tickets/ (Part 2)"],"none")
screen("deleteAcct","SCR-044","Delete account","Type DELETE to erase account (or device data for guests)","privacy","screens/profile/SettingsScreens.tsx#DeleteAccountScreen","P1","implemented",["DELETE /users/me/"],"api:tests/test_auth.py")
for key,sid,name in [("zIntro","SCR-046","Z-Trigger intro"),("zConsent","SCR-047","Z-Trigger consent"),("zSetup","SCR-048","Z-Trigger setup"),("zHome","SCR-049","Z-Trigger home"),("zEvent","SCR-050","Z-Trigger event")]:
    screen(key,sid,name,"Automatic parking detection (Bluetooth)","z-trigger","—","experimental","not-started",["(experimental)"],"none","Behind feature flag z_trigger; BRD: optional opt-in experiment, never required for launch.")
for key,sid,name in [("scoutList","SCR-051","Scout tasks"),("scoutTask","SCR-052","Scout task")]:
    screen(key,sid,name,"Field verification tasks for scouts","scouts","—","P2","not-started",["(Part 2) /scouts/assignments/"],"none")
for key,sid,name in [("pro","SCR-053","Zpot Pro paywall"),("proWelcome","SCR-054","Pro welcome"),("manageSub","SCR-055","Manage subscription"),("cancelSub","SCR-056","Cancel subscription"),
                     ("commute","SCR-057","Commute planner"),("vehicles","SCR-058","Vehicles & permits"),("insights","SCR-059","Savings & history")]:
    screen(key,sid,name,"Monetisation concept (prototype marks as concept)","monetisation","—","post-MVP","not-started",["(post-MVP)"],"none")

OVERLAYS = {
 "osLoc": ("OVL-001","Simulated OS location prompt","Replaced by the real OS permission dialog","implemented"),
 "layers": ("OVL-002","Map layers & legend","components/maps/LayersSheet.tsx","implemented"),
 "adWhy": ("OVL-003","Why this ad?","post-MVP (ads not shipped)","not-started"),
 "saveGuest": ("OVL-004","Save as guest / create account","Part 2 (saving)","not-started"),
 "notifPrime": ("OVL-005","Notification permission primer at session start","Part 2 (sessions)","not-started"),
 "cancelReport": ("OVL-006","Discard report?","Part 2 (reports)","not-started"),
 "rename": ("OVL-007","Rename saved place","Part 2 (saved)","not-started"),
 "removeConfirm": ("OVL-008","Remove saved place","Part 2 (saved)","not-started"),
 "signOut": ("OVL-009","Sign out confirm","components/common/BottomSheet.tsx#ConfirmDialog (ProfileScreen)","implemented"),
 "store": ("OVL-010","App-store purchase sheet","post-MVP","not-started"),
}

# Handler → (expected action, implementation status, RN destination/notes, backend op)
SECTION_STATUS = {}
def hs(names, status, rn, backend=""):
    for n in names.split():
        SECTION_STATUS[n] = (status, rn, backend)
hs("setEn setPt toWelcome toOnboard onbNext toLocPerm toLocPermFromMap askLoc togglePrecise locAllow locDeny locRestricted locOff locUnavail locManual locLater openDeviceSettings toAccount guest toSignIn toRegister toSignInReplace toRegisterReplace toLegalTerms toLegalPrivacy",
   "implemented", "onboarding/auth screens", "")
hs("togglePw register signIn resend verifyOk verifyExpired finishAuth toForgot forgotSend forgotLink forgotSave forgotDone", "implemented", "auth screens", "auth API")
hs("toSearch toFilters toPlan quickFree toggleView toList retryMap retryNet openLayers zoomIn zoomOut recenter searchArea pd pm pu cycleSheet expandSheet clearSel widen showPaid resetFilters navSel openSel setQ clearQ useMyLocation hourMinus hourPlus durMinus durPlus plFree plPaid planApply fReset fFree fTimed fPaid fVer fAcc fApply toggleVerif share toNavPick arrive unavailable toExploreTab tabExplore tabSaved tabActivity tabProfile toLegal toHelp toPrivacy toLanguage toPprefs toAcctMgmt toDelete setDel doDelete askSignOut doSignOut ppFree ppAlt ppBadge saveName cycleLoc pvPers pvAna back stop closeOv",
   "implemented", "explore/search/plan/filters/details/profile", "parking/places API")
hs("toNotifs toNprefs enableNotif npSession npRules npReports npNews", "routed-placeholder", "Part2(notifs) / NotificationsIntro", "Part 2")
hs("toggleSave saveLocal saveWithAccount toRegisterFromSaved setRename doRename doRemove", "routed-placeholder", "Part2(save)", "Part 2 /saved/")
hs("toStartSession sdMinus sdPlus startSessionGo notifAllow notifDeny toSession toEditSession edMinus edPlus edSave leaveByDeadline toEndSession endLeaving endCost endGo reportFromSession", "routed-placeholder", "Part2(session)", "Part 2 /sessions/")
hs("reportFromMap reportFromDetails reportGeneric infoNo toMyReports pinL pinR pinU pinD scopeSpot scopeSeg toRDetails rdConfirm rdDesc photoCam photoLib photoRemove toRReview submitReport askCancelReport discardReport openLastReport setAppeal sendAppeal vYes vNo vUnsure openVacSpot infoYes infoUnsure",
   "routed-placeholder", "Part2(report)", "Part 2 /reports/")
hs("toGuidance toSupport suDesc suShot suInclude suSend supportDone dataExport", "not-started", "Part 2 support/privacy", "Part 2")
hs("toZ toZConsent zcBg zcBat zDecline toZSetup zFinish zToggle zSimulate zFail zConfirm zCorrect zDismiss zDisable zDelete", "not-started", "experimental (flagged)", "")
hs("toScout scNotes scPhoto scSubmit", "not-started", "Part 2 scouts", "")
hs("toPro toProOrManage restore proStart storeCancel storeConfirm toCommuteFromWelcome switchPlan toCancelSub doCancelSub resubscribe toCommute toVehicles toInsights cmHourMinus cmHourPlus cmDurMinus cmDurPlus cmSave vhAdd insExport adWhy adHide adToPro adPrefs pvAds toPartner partnerGo",
   "not-started", "post-MVP monetisation", "")
hs("adv5 adv15 adv60 devOffline devMapFail devDriving devRuleChange devReview devExpire devZ devScout devLang devRestart devReset devMonet devProReset passenger", "dev-only", "prototype controls panel (not shipped)", "")

def parse():
    s = open(PROTO, encoding="utf-8").read()
    tpl = s[s.index("<x-dc>"):s.index("</x-dc>")]
    # screen/overlay regions
    marks = [(m.start(), m.group(1), m.group(2)) for m in re.finditer(r'<sc-if value="\{\{\s*(is|ov)\.(\w+)', tpl)]
    def region(pos):
        cur_s, cur_o = None, None
        for p, kind, name in marks:
            if p > pos: break
            if kind == "is": cur_s = name
            else: cur_o = name
        return cur_s, cur_o
    out = []
    for m in re.finditer(r'<(\w[\w-]*)([^>]*?)\s(on[A-Za-z]+)="\{\{\s*([^}]+?)\s*\}\}"([^>]*)>', tpl):
        tag, ev, handler = m.group(1), m.group(3), m.group(4).strip()
        rest = tpl[m.end(): m.end() + 1200]
        close = rest.find(f"</{tag}>")
        inner = "" if tag in ("input", "textarea") else (rest[:close] if close >= 0 else rest[:200])
        label = re.sub(r"<[^>]+>", " ", inner)
        label = re.sub(r"\{\{[^}]*\}\}", "…", html.unescape(label))
        label = re.sub(r"\s+", " ", label).strip()[:70]
        attrs = m.group(2) + m.group(5)
        aria = re.search(r'aria-label="([^"]+)"', attrs)
        if aria and not label: label = re.sub(r"\{\{[^}]*\}\}", "…", html.unescape(aria.group(1)))
        if not label:
            ph = re.search(r'placeholder="([^"]+)"', attrs)
            fld = re.match(r"fm\.(\w+)|h\.(\w+)", handler)
            label = f"[{tag}] {html.unescape(ph.group(1))}" if ph else f"[{tag}] {(fld.group(1) or fld.group(2)) if fld else ''}".strip()
        sc, ov = region(m.start())
        dev = sc is None and ov is None
        out.append(dict(screen=sc or ("dev-panel" if dev else "?"), overlay=ov, element=tag, event=ev, handler=handler, label=label))
    return out

def h_name(handler):
    m = re.match(r"(?:h|fm)\.(\w+)", handler)
    return m.group(1) if m else handler

def main():
    inter = parse()
    by_screen = defaultdict(list)
    for i in inter: by_screen[i["overlay"] or i["screen"]].append(i)
    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    head = f"<!-- generated by scripts/tools/gen_migration_docs.py at {gen}; edit the generator, not this file -->\n"

    # ---------------- screen inventory
    L = [head, "# Screen inventory\n",
         f"Source: `Interactive prototype (play me)-html/Main.dc.html` (single design-component artboard). "
         f"**{len(S)} screens** and **{len(OVERLAYS)} overlays** discovered by parsing every `<sc-if value=\"{{{{is.*}}}}\">` / "
         f"`ov.*` block (hidden and interaction-only screens included). Reference screenshots: `docs/migration/source-screenshots/` "
         f"(116 captures, regenerate with `scripts/tools/capture-prototype-screens.cjs`).\n",
         "Status values: `implemented` · `partial` · `routed-placeholder` (entry exists; explicit Part 2 screen) · `not-started` · `dev-only`.\n"]
    counts = defaultdict(int)
    for v in S.values(): counts[v["status"]] += 1
    L.append("| Status | Screens |\n|---|---|\n" + "\n".join(f"| {k} | {n} |" for k, n in sorted(counts.items())) + "\n")
    shots = sorted(f for f in os.listdir(os.path.join(DOCS, "migration/source-screenshots")) if f.endswith(".png"))
    L.append("| ID | Prototype key | Name | Purpose | Module | Inputs | Buttons (bindings) | Entry → Exit | API dependencies | RN destination | Priority | Status | Tests | Screenshots | Notes |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for key, v in S.items():
        btns = sorted({i["label"] for i in by_screen.get(key, []) if i["event"] == "onClick"})
        L.append(f"| {v['id']} | `{key}` | {v['name']} | {v['purpose']} | {v['module']} | {v['inputs'] or '—'} | "
                 f"{len(by_screen.get(key, []))} ({'; '.join(btns[:6])}{'…' if len(btns) > 6 else ''}) | {v['entry'] or '—'} → {v['exit'] or '—'} | "
                 f"{'<br>'.join(v['apis']) or '—'} | `{v['rn']}` | {v['phase']} | **{v['status']}** | {v['tests']} | {len([f for f in shots if f.startswith(v['id'] + '-') or f.startswith(v['id'] + 'a') or f.startswith(v['id'] + 'b')])} | {v['note']} |")
    L.append("\n## Overlays\n\n| ID | Key | Name | RN destination / disposition | Status | Bindings |\n|---|---|---|---|---|---|")
    for k, (oid, name, rn, st) in OVERLAYS.items():
        L.append(f"| {oid} | `{k}` | {name} | {rn} | **{st}** | {len(by_screen.get(k, []))} |")
    L.append("\n## Prototype-only controls\n\nThe artboard's *Prototype controls* panel (demo clock, journeys, world events, flags) "
             f"has {len(by_screen.get('dev-panel', []))} bindings. It simulates the world and is **not** part of the app; equivalents are "
             "real (offline via NetInfo, map failure via MapLibre `onDidFailLoadingMap`, language in Profile) or Part 2.")
    open(os.path.join(DOCS, "migration/screen-inventory.md"), "w").write("\n".join(L) + "\n")

    # ---------------- interaction inventory
    L = [head, "# Interaction inventory\n",
         f"Every event binding in the prototype template: **{len(inter)}** bindings "
         f"({len({h_name(i['handler']) for i in inter})} distinct handlers). Labels are the visible text (or aria-label/placeholder). "
         "Status and backend operation come from the handler mapping in the generator.\n",
         "| # | Screen / overlay | Element | Event | Visible label | Handler | Expected action / destination | Backend operation | Status |",
         "|---|---|---|---|---|---|---|---|---|"]
    summ = defaultdict(int)
    for n, i in enumerate(inter, 1):
        name = h_name(i["handler"])
        if i["handler"].startswith("h."):
            st, rn, be = SECTION_STATUS.get(name, ("review", "unmapped handler", ""))
        else:  # form fields (fm.*) and per-item list actions inherit the status of their screen/overlay
            parent = OVERLAYS.get(i["overlay"])[3] if i["overlay"] in OVERLAYS else S.get(i["screen"], {}).get("status", "review")
            st, rn, be = parent, ("form field" if i["handler"].startswith("fm.") else "per-item list action"), ""
            if st == "partial": st = "implemented" if i["screen"] in ("explore", "saved") and i["handler"] in ("mk.select", "ex.rec.open", "c.open", "r.pick") else st
        if (i["overlay"] or i["screen"]) == "dev-panel": st, rn = "dev-only", "prototype controls"
        sv = S.get(i["screen"])
        if sv and sv["status"] in ("not-started", "routed-placeholder") and st == "implemented" and name not in ("back", "stop", "closeOv"):
            st = sv["status"]
        summ[st] += 1
        L.append(f"| {n} | {i['overlay'] or i['screen']} | {i['element']} | {i['event']} | {i['label'].replace('|', '/')} | `{i['handler']}` | {rn} | {be or '—'} | {st} |")
    L.insert(3, "| Status | Bindings |\n|---|---|\n" + "\n".join(f"| {k} | {v} |" for k, v in sorted(summ.items())) + "\n\n"
             "Validation/success/error behaviour for implemented interactions is specified per flow in "
             "`docs/migration/navigation-matrix.md` and enforced by the tests listed in the screen inventory. "
             "Dynamic list bindings (e.g. `x.pick`, `c.open`) are per-item actions of the parent list.\n")
    open(os.path.join(DOCS, "migration/interaction-inventory.md"), "w").write("\n".join(L) + "\n")

    # ---------------- implementation-status.json
    try:
        commit = subprocess.check_output(["git", "-C", ROOT, "rev-parse", "HEAD"], text=True).strip()
        dirty = bool(subprocess.check_output(["git", "-C", ROOT, "status", "--porcelain"], text=True).strip())
    except Exception:
        commit, dirty = None, None
    status_path = os.path.join(DOCS, "implementation-status.json")
    prev = json.load(open(status_path)) if os.path.exists(status_path) else {}
    data = {
        "generated_at": gen, "part": 1, "git": {"branch": "main", "commit": commit, "uncommitted_changes": dirty},
        "status_vocabulary": ["implemented", "partial", "routed-placeholder", "not-started", "dev-only"],
        "screens": [{k: v[k] for k in ("id", "key", "name", "module", "rn", "phase", "status", "apis", "tests")} | {"prototype_key": v["key"]} for v in S.values()],
        "overlays": [{"id": oid, "key": k, "name": n, "rn": rn, "status": st} for k, (oid, n, rn, st) in OVERLAYS.items()],
        "interactions": {"total_bindings": len(inter), "by_status": dict(summ)},
    }
    for k in ("endpoints", "features", "tests", "builds"):
        if k in prev: data[k] = prev[k]
    json.dump(data, open(status_path, "w"), indent=2, ensure_ascii=False)
    print(f"screens={len(S)} overlays={len(OVERLAYS)} interactions={len(inter)} by_status={dict(summ)}")

if __name__ == "__main__":
    main()
