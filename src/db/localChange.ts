// Viimeisin tällä laitteella tehty kirjaus, kuittaus tai ohitus (ms). Synkronoinnin tuomat muutokset
// eivät päivitä tätä, joten esim. tavoitteen täyttymisen ääni soi vain omasta toiminnasta (SPEC 16).

let last = 0;

export function noteLocalChange(): void {
  last = Date.now();
}

export function msSinceLocalChange(): number {
  return Date.now() - last;
}
