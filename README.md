# Liikkumisen seuranta

Offline-PWA lapsen (ja tarvittaessa aikuisen) liikkumisen seurantaan suhteessa suomalaisiin liikkumissuosituksiin. Määrittely: [SPEC.md](SPEC.md).

- Kaikki data pysyy laitteen selaimessa (IndexedDB). Sovellus ei tee verkkokutsuja eikä lähetä tietoja mihinkään.
- PC:n ja puhelimen tiedot yhdistetään käyttäjän omassa pilvikansiossa olevilla tiedostoilla.
- Julkaistu versio: https://tuumis.github.io/liikkumisen-seuranta/

## Kehitys

```bash
npm install
npm run dev        # kehityspalvelin
npm test           # Vitest (domain, tietokanta, varmuuskopio, synkronointi)
npm run build      # tuotantoversio dist/-kansioon
npm run preview:lan  # tuotantoversio lähiverkkoon (puhelintestaus ilman HTTPS:ää)
```

Push `main`-haaraan ajaa testit ja julkaisee GitHub Pagesiin (`.github/workflows/deploy.yml`).
