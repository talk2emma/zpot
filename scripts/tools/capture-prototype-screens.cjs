/*
 * Captures reference screenshots of every screen/overlay in the read-only HTML prototype.
 * Usage:
 *   (cd "<prototype dir>" && python3 -m http.server 8765) &
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright node scripts/tools/capture-prototype-screens.cjs
 * Drives the prototype's own state machine (its DCLogic component) — no prototype file is modified.
 */
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const OUT = process.env.OUT_DIR || path.join(__dirname, '../../docs/migration/source-screenshots');
const URL = process.env.PROTOTYPE_URL || 'http://localhost:8765/Main.dc.html';

// Each step: [fileName, pageFunction(dc,h,S,P) run inside the page, waitMs]
const STEPS = [
  ['SCR-001-splash', (dc,h,S)=>{ S({screen:'splash'}); }],
  ['SCR-002-language', (dc,h,S)=>{ S({screen:'language'}); }],
  ['SCR-003-welcome', (dc,h,S)=>{ S({screen:'welcome'}); }],
  ['SCR-004a-onboard-1', (dc,h,S)=>{ S({screen:'onboard',onb:0}); }],
  ['SCR-004b-onboard-2', (dc,h,S)=>{ S({screen:'onboard',onb:1}); }],
  ['SCR-004c-onboard-3', (dc,h,S)=>{ S({screen:'onboard',onb:2}); }],
  ['SCR-005-locPerm', (dc,h,S)=>{ S({screen:'locPerm'}); }],
  ['OVL-001-osLoc', (dc,h,S)=>{ S({screen:'locPerm',overlay:'osLoc'}); }],
  ['SCR-006a-locOutcome-precise', (dc,h,S)=>{ S({screen:'locOutcome',overlay:null,loc:'precise'}); }],
  ['SCR-006b-locOutcome-approx', (dc,h,S)=>{ S({loc:'approx'}); }],
  ['SCR-006c-locOutcome-denied', (dc,h,S)=>{ S({loc:'denied'}); }],
  ['SCR-006d-locOutcome-restricted', (dc,h,S)=>{ S({loc:'restricted'}); }],
  ['SCR-006e-locOutcome-off', (dc,h,S)=>{ S({loc:'off'}); }],
  ['SCR-006f-locOutcome-unavailable', (dc,h,S)=>{ S({loc:'unavailable'}); }],
  ['SCR-007-account', (dc,h,S)=>{ S({screen:'account'}); }],
  ['SCR-008a-signin', (dc,h,S)=>{ S({screen:'signin',formErr:{}}); }],
  ['SCR-008b-signin-errors', (dc,h,S)=>{ S({formErr:{email:'Enter a valid email address.',password:'Enter your password.',general:'Email or password is incorrect.'}}); }],
  ['SCR-009a-register', (dc,h,S)=>{ S({screen:'register',formErr:{}}); }],
  ['SCR-009b-register-errors', (dc,h,S)=>{ S({formErr:{email:'Enter a valid email address.',password:'Use at least 8 characters.',password2:'Passwords don’t match.',terms:'Please accept the terms to continue.'}}); }],
  ['SCR-010a-verify-pending', (dc,h,S)=>{ S({screen:'verify',formErr:{},verifyState:'pending',form:Object.assign({},dc.state.form,{email:'rita@example.pt'})}); }],
  ['SCR-010b-verify-expired', (dc,h,S)=>{ S({verifyState:'expired'}); }],
  ['SCR-010c-verify-done', (dc,h,S)=>{ S({verifyState:'done'}); }],
  ['SCR-011a-forgot-email', (dc,h,S)=>{ S({screen:'forgot',fpStage:'email'}); }],
  ['SCR-011b-forgot-sent', (dc,h,S)=>{ S({fpStage:'sent'}); }],
  ['SCR-011c-forgot-newpw', (dc,h,S)=>{ S({fpStage:'newpw'}); }],
  ['SCR-011d-forgot-done', (dc,h,S)=>{ S({fpStage:'done'}); }],
  ['SCR-012-legal', (dc,h,S)=>{ S({screen:'legal',legalTab:'terms'}); }],
  ['SCR-013a-explore-noarea', (dc,h,S)=>{ S({firstRun:false,screen:'explore',stack:[],loc:'denied',dest:null}); }],
  ['SCR-013b-explore-map-saldanha', (dc,h,S)=>{ dc.jump('j9'); S({selVac:null}); }, 1200],
  ['SCR-013c-explore-sheet-full', (dc,h,S)=>{ S({sheet:'full'}); }],
  ['SCR-013d-explore-sheet-peek', (dc,h,S)=>{ S({sheet:'peek'}); }],
  ['SCR-013e-explore-list', (dc,h,S)=>{ S({sheet:'half',view:'list'}); }],
  ['SCR-013f-explore-selected-spot', (dc,h,S)=>{ S({view:'map',sel:'s1'}); }],
  ['SCR-013g-explore-selected-vacancy', (dc,h,S)=>{ S({sel:null,selVac:'V1'}); }],
  ['SCR-013h-explore-no-free', (dc,h,S)=>{ dc.jump('j4'); }, 1200],
  ['SCR-013i-explore-offline', (dc,h,S)=>{ dc.jump('j9'); S({selVac:null,offline:true}); }, 1200],
  ['SCR-013j-explore-mapfail', (dc,h,S)=>{ S({offline:false,mapFail:true}); }],
  ['SCR-013k-explore-loading', (dc,h,S)=>{ S({mapFail:false,loading:true}); }],
  ['OVL-002-layers', (dc,h,S)=>{ S({loading:false,overlay:'layers'}); }],
  ['OVL-003-adWhy', (dc,h,S)=>{ S({overlay:'adWhy'}); }],
  ['SCR-014a-search-empty', (dc,h,S)=>{ S({overlay:null,screen:'search',q:'',recents:[]}); }],
  ['SCR-014b-search-query', (dc,h,S)=>{ S({q:'cam'}); }],
  ['SCR-014c-search-none', (dc,h,S)=>{ S({q:'zzzz'}); }],
  ['SCR-014d-search-unsupported', (dc,h,S)=>{ S({q:'porto',searchMsg:'Zpot isn’t available in Porto yet. The pilot covers Lisbon only.'}); }],
  ['_prep-plan', (dc,h,S)=>{ dc.jump('j3'); }],
  ['SCR-015-plan', (dc,h,S)=>{ S({screen:'explore',stack:[]}); }, 200],
  ['SCR-015-plan', (dc,h,S)=>{ dc.renderVals().h.toPlan(); }],
  ['SCR-015b-plan-midnight', (dc,h,S)=>{ S({plan:Object.assign({},dc.state.plan,{hour:22,dur:5})}); }],
  ['_prep-filters', (dc,h,S)=>{ dc.jump('j9'); S({selVac:null}); }, 900],
  ['SCR-016-filters', (dc,h,S)=>{ dc.renderVals().h.toFilters(); }],
  ['SCR-017a-details', (dc,h,S)=>{ dc.jump('j6'); }],
  ['SCR-017b-details-verification-open', (dc,h,S)=>{ S({verifOpen:true}); }],
  ['SCR-017c-details-restricted', (dc,h,S)=>{ S({sel:'s4',verifOpen:false}); }],
  ['SCR-017d-details-unknown', (dc,h,S)=>{ S({sel:'s5'}); }],
  ['SCR-017e-details-partner', (dc,h,S)=>{ dc.jump('jp'); }],
  ['OVL-004-saveGuest', (dc,h,S)=>{ dc.jump('j6'); S({overlay:'saveGuest'}); }],
  ['SCR-018a-navPick', (dc,h,S)=>{ S({overlay:null,screen:'navPick',navErr:null}); }],
  ['SCR-018b-navPick-waze-error', (dc,h,S)=>{ S({navErr:'Waze isn’t installed. Choose another app, or install Waze and try again.'}); }],
  ['SCR-019-handoff', (dc,h,S)=>{ S({screen:'handoff',navApp:'google',navErr:null}); }],
  ['SCR-020-navReturn', (dc,h,S)=>{ S({screen:'navReturn'}); }],
  ['SCR-021-partner', (dc,h,S)=>{ dc.jump('jp'); S({screen:'partner'}); }],
  ['_prep-session', (dc,h,S)=>{ dc.jump('j6'); }],
  ['SCR-022-startSession', (dc,h,S)=>{ dc.renderVals().h.toStartSession(); }],
  ['OVL-005-notifPrime', (dc,h,S)=>{ S({overlay:'notifPrime'}); }],
  ['SCR-023a-session', (dc,h,S)=>{ S({overlay:null,notif:'granted'}); dc.startSession(); }],
  ['SCR-023b-session-rule-change', (dc,h,S)=>{ dc.ruleChange(); }],
  ['SCR-024-editSession', (dc,h,S)=>{ dc.renderVals().h.toEditSession(); }],
  ['_prep-end', (dc,h,S)=>{ dc.back(); }],
  ['SCR-025-endSession', (dc,h,S)=>{ dc.renderVals().h.toEndSession(); }],
  ['SCR-026-summary', (dc,h,S)=>{ S({endd:Object.assign({},dc.state.endd,{cost:'0',outcome:'Easy'})}); dc.endSession(); }],
  ['_prep-report', (dc,h,S)=>{ dc.jump('j9'); S({selVac:null}); }, 900],
  ['SCR-027-rType', (dc,h,S)=>{ dc.startReport(null); }],
  ['SCR-028a-rLoc', (dc,h,S)=>{ dc.setRd({type:'incorrect'}); }, 150],
  ['SCR-028a-rLoc', (dc,h,S)=>{ S({screen:'rLoc'}); }],
  ['SCR-028b-rLoc-segment', (dc,h,S)=>{ dc.setRd({scope:'segment',dx:8}); }],
  ['SCR-029a-rDetails', (dc,h,S)=>{ S({screen:'rDetails',rdTried:false}); }],
  ['SCR-029b-rDetails-errors', (dc,h,S)=>{ S({rdTried:true}); }],
  ['SCR-029c-rDetails-leaving', (dc,h,S)=>{ dc.setRd({type:'leaving'}); S({rdTried:false}); }],
  ['SCR-029d-rDetails-closure', (dc,h,S)=>{ dc.setRd({type:'closure'}); }],
  ['SCR-030-rReview', (dc,h,S)=>{ dc.setRd({type:'incorrect',issue:'Hours are wrong',desc:'Sign says paid until 20:00 now',photo:'IMG_2048.jpg'}); S({screen:'rReview'}); }],
  ['OVL-006-cancelReport', (dc,h,S)=>{ S({overlay:'cancelReport'}); }],
  ['SCR-031-rSuccess', (dc,h,S)=>{ S({overlay:null}); dc.submitReport(); }, 1200],
  ['SCR-032-myReports', (dc,h,S)=>{ S({screen:'myReports'}); }],
  ['SCR-033-reportDetail', (dc,h,S)=>{ S({screen:'reportDetail',openReport:dc.state.lastReport}); }],
  ['SCR-033b-reportDetail-rejected', (dc,h,S)=>{ S({reports:dc.state.reports.map(r=>Object.assign({},r,{photo:null}))}); dc.processReviews(); }],
  ['SCR-034a-saved-empty', (dc,h,S)=>{ S({screen:'saved',stack:[],saved:[],recents:[]}); }],
  ['SCR-034b-saved-items', (dc,h,S)=>{ dc.jump('j11'); }],
  ['OVL-007-rename', (dc,h,S)=>{ S({overlay:'rename',renameId:'a2',renameText:'Gym — Alvalade'}); }],
  ['OVL-008-removeConfirm', (dc,h,S)=>{ S({overlay:'removeConfirm',removeId:'a2'}); }],
  ['SCR-035-activity', (dc,h,S)=>{ S({overlay:null,screen:'activity',stack:[]}); }],
  ['SCR-036-notifs', (dc,h,S)=>{ S({screen:'notifs'}); }],
  ['SCR-037-nprefs', (dc,h,S)=>{ S({screen:'nprefs'}); }],
  ['SCR-038a-profile-user', (dc,h,S)=>{ S({screen:'profile',stack:[]}); }],
  ['OVL-009-signOut', (dc,h,S)=>{ S({overlay:'signOut'}); }],
  ['SCR-038b-profile-guest', (dc,h,S)=>{ S({overlay:null,user:null}); }],
  ['SCR-038c-profile-scout-z', (dc,h,S)=>{ S({user:{email:'rita@example.pt',expired:true},scout:true,zflag:true}); }],
  ['SCR-039-acctMgmt', (dc,h,S)=>{ S({screen:'acctMgmt',user:{email:'rita@example.pt',expired:false}}); }],
  ['SCR-040-pprefs', (dc,h,S)=>{ S({screen:'pprefs'}); }],
  ['SCR-041-privacy', (dc,h,S)=>{ S({screen:'privacy'}); }],
  ['SCR-042-help', (dc,h,S)=>{ S({screen:'help',helpOpen:1}); }],
  ['SCR-043a-support', (dc,h,S)=>{ S({screen:'support',supportMode:'support',supportRef:null,supportTried:false,support:{cat:'',desc:'',shot:false,include:false}}); }],
  ['SCR-043b-support-guidance', (dc,h,S)=>{ S({supportMode:'guidance',guidanceCtx:'s1',supportTried:true}); }],
  ['SCR-043c-support-done', (dc,h,S)=>{ S({supportRef:'ZS-4800'}); }],
  ['SCR-044-deleteAcct', (dc,h,S)=>{ S({screen:'deleteAcct',delText:''}); }],
  ['SCR-045-language-from-profile', (dc,h,S)=>{ S({screen:'language',firstRun:false}); }],
  ['SCR-046-zIntro', (dc,h,S)=>{ dc.jump('j17'); }],
  ['SCR-047-zConsent', (dc,h,S)=>{ S({screen:'zConsent'}); }],
  ['SCR-048a-zSetup', (dc,h,S)=>{ S({screen:'zSetup'}); }],
  ['SCR-048b-zSetup-blocked', (dc,h,S)=>{ S({zCond:'btoff'}); }],
  ['SCR-049-zHome', (dc,h,S)=>{ S({zCond:'ok',zState:'ready',screen:'zHome'}); }],
  ['SCR-050-zEvent', (dc,h,S)=>{ S({zState:'detected',zEventAt:dc.now(),screen:'zEvent'}); }],
  ['SCR-051-scoutList', (dc,h,S)=>{ S({scout:true,screen:'scoutList'}); }],
  ['SCR-052a-scoutTask', (dc,h,S)=>{ S({screen:'scoutTask',scoutTask:'T1',scoutForm:{outcome:'',notes:'',photo:false},scoutTried:false}); }],
  ['SCR-052b-scoutTask-errors', (dc,h,S)=>{ S({scoutTried:true}); }],
  ['SCR-053-pro', (dc,h,S)=>{ S({screen:'pro',proPick:'annual'}); }],
  ['OVL-010-store', (dc,h,S)=>{ S({overlay:'store'}); }],
  ['SCR-054-proWelcome', (dc,h,S)=>{ dc.renderVals().h.storeConfirm(); }],
  ['SCR-055-manageSub', (dc,h,S)=>{ S({screen:'manageSub'}); }],
  ['SCR-056-cancelSub', (dc,h,S)=>{ S({screen:'cancelSub'}); }],
  ['SCR-057-commute', (dc,h,S)=>{ S({screen:'commute'}); }],
  ['SCR-058-vehicles', (dc,h,S)=>{ S({screen:'vehicles'}); }],
  ['SCR-059-insights', (dc,h,S)=>{ S({screen:'insights'}); }],
  ['SCR-013l-explore-ad-pt', (dc,h,S)=>{ dc.jump('jm'); }, 1200],
  ['SCR-013l-explore-ad-pt', (dc,h,S)=>{ S({pro:null,lang:'pt'}); }],
];

(async () => {
  const fs = require('fs'); fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 }, deviceScaleFactor: 2 });
  await page.goto(URL); await page.waitForTimeout(600);
  await page.evaluate(() => {
    const host = document.querySelector('.scr');
    const k = Object.keys(host).find(x => x.startsWith('__reactFiber'));
    let f = host[k]; while (f && !(f.stateNode && f.stateNode.logic && typeof f.stateNode.logic.jump === 'function')) f = f.return;
    if (!f) throw new Error('DC component not found');
    window.__dc = f.stateNode.logic; window.__dc.later = function(){}; // the DC runtime keeps the prototype's logic instance on .logic
  });
  const clip = await page.evaluate(() => { const r = document.querySelector('.scr').parentElement.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const results = [];
  for (const [name, fn, wait] of STEPS) {
    try {
      await page.evaluate(`(function(){var dc=window.__dc;dc.later=function(f,ms){var s=dc;setTimeout(function(){f.call(s)},ms)};var S=function(p){dc.setState(p)};(${fn.toString()})(dc,null,S);})()`);
      await page.waitForTimeout(wait || 450);
      await page.evaluate(() => { window.__dc.setState({ toast: null }); });
      await page.waitForTimeout(80);
      const scr = await page.evaluate(() => window.__dc.state.screen + (window.__dc.state.overlay ? '+' + window.__dc.state.overlay : ''));
      if (!name.startsWith('_')) await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
      results.push({ name, state: scr, ok: true });
    } catch (e) { results.push({ name, ok: false, error: String(e).slice(0, 200) }); }
  }
  fs.writeFileSync(path.join(OUT, 'capture-manifest.json'), JSON.stringify({ capturedAt: new Date().toISOString(), viewport: '390x844 @2x', results }, null, 2));
  console.log(results.filter(r => !r.ok)); console.log('captured', results.filter(r => r.ok).length, '/', results.length);
  await browser.close();
})();
