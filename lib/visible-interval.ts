/** Sann når siden ligger i en bakgrunnsfane og ingen ser resultatet. */
function documentHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

// `setInterval` som hopper over tikk mens fanen ligger i bakgrunnen.
//
// En åpen fane pollet videre i timevis uten at noen så svaret, og det sto for
// mesteparten av Supabase-egressen: én fane på prosjektsiden ble til ~10 800
// pollinger i døgnet. Hvert kall koster to Supabase-forespørsler — `auth.getUser`
// pluss selve spørringen — så gratisplanens 5 GB gikk med på under en måned.
//
// Kallerne henter allerede inn på nytt ved `visibilitychange` eller `focus`, så
// et hoppet tikk blir tatt igjen i det fanen vises igjen. Dataene er derfor like
// ferske for den som faktisk ser på dem.
//
// `isHidden` kan overstyres i tester, som kjører i Node uten `document`.
export function setVisibleInterval(
  callback: () => void,
  ms: number,
  isHidden: () => boolean = documentHidden
) {
  const id = setInterval(() => {
    if (isHidden()) return
    callback()
  }, ms)
  return () => clearInterval(id)
}
