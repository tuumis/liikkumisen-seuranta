// Yhteysosoite kootaan vasta selaimessa, jottei se ole lähdekoodissa yhtenä merkkijonona (vähemmän roskapostia).
const flip = (s: string) => s.split('').reverse().join('');
export const contactAddress = () => `${flip('44nenotsumt')}@${flip('moc.liamg')}`;
