
/*
 * LAMB3RT TCG — Impression NIIMBOT D110_M
 * Version avec caractères agrandis
 */
(function () {
  'use strict';

  if (window.Lamb3rtImpression) return;

  const DRIVER_URL =
    'https://cdn.jsdelivr.net/gh/iscarelli/niimbot-web-bluetooth@main/src/niimbot.js';

  const MODEL = {
    name_prefixes: ['D110'],
    id: 2320,
    task: 'v4',
    dpi: 203,
    density: 3,
    label_type: 1,
    speed: 1
  };

  const SIZE = {
    w_px: 96,
    h_px: 320,
    offset_y_px: 0
  };

  const state = {
    driverPromise: null,
    connected: false,
    printer: null,
    busy: false
  };

  function setStatus(message) {
    const el = document.getElementById('niimbotStatus');
    if (el) el.textContent = message;
  }

  function loadDriver() {
    if (window.Niimbot) return Promise.resolve(window.Niimbot);
    if (state.driverPromise) return state.driverPromise;

    state.driverPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = DRIVER_URL;
      script.async = true;

      script.onload = () => {
        if (window.Niimbot) resolve(window.Niimbot);
        else reject(new Error('Objet Niimbot introuvable.'));
      };

      script.onerror = () =>
        reject(new Error('Impossible de charger le pilote NIIMBOT.'));

      document.head.appendChild(script);
    }).catch(error => {
      state.driverPromise = null;
      throw error;
    });

    return state.driverPromise;
  }

  function checkBluetooth(driver) {
    if (location.protocol !== 'https:' &&
        location.hostname !== 'localhost') {
      throw new Error('Ouvre le site depuis HTTPS dans Chrome Android.');
    }

    if (!driver.isSupported || !driver.isSupported()) {
      throw new Error('Web Bluetooth indisponible. Utilise Chrome Android.');
    }
  }

  async function connect() {
    const driver = await loadDriver();
    checkBluetooth(driver);

    setStatus('Recherche de la NIIMBOT…');

    const info = await driver.identify(MODEL);

    state.printer = driver.printer || info || null;
    state.connected = true;

    setStatus('NIIMBOT détectée : D110_M. Connexion identifiée.');

    return state.printer;
  }

  async function disconnect() {
    const driver = window.Niimbot;

    if (driver && typeof driver.disconnect === 'function') {
      await driver.disconnect();
    }

    state.connected = false;
    state.printer = null;

    setStatus('Imprimante déconnectée.');
  }

function money(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    throw new Error('Prix invalide : ' + value);
  }

  return Math.round(n).toString() + ' $';
}

  // NOUVEAU FORMAT : caractères beaucoup plus gros
  function makeLabelImage(priceA, priceB, fontSize) {
    const source = document.createElement('canvas');
    source.width = 800;
    source.height = 240;

    const ctx = source.getContext('2d');

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 800, 240);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Taille augmentée : environ 2,5 fois l'ancienne taille source.
    const baseFont = 110;

    function drawPrice(value, centerX) {
      const text = money(value);
      let font = baseFont;

      ctx.font = '900 ' + font + 'px Arial';

      // Réduire uniquement si le prix dépasse sa moitié.
      while (ctx.measureText(text).width > 385 && font > 65) {
        font -= 3;
        ctx.font = '900 ' + font + 'px Arial';
      }

      ctx.fillText(text, centerX, 120);
    }

    drawPrice(priceA, 200);

    if (priceB !== undefined && priceB !== null) {
      drawPrice(priceB, 600);
    }

    // Conversion vers le format natif de l'imprimante.
    const printerCanvas = document.createElement('canvas');
    printerCanvas.width = SIZE.w_px;
    printerCanvas.height = SIZE.h_px;

    const out = printerCanvas.getContext('2d');

    out.fillStyle = '#fff';
    out.fillRect(0, 0, SIZE.w_px, SIZE.h_px);

    out.translate(SIZE.w_px, 0);
    out.rotate(Math.PI / 2);
    out.drawImage(source, 0, 0, SIZE.h_px, SIZE.w_px);

    return printerCanvas.toDataURL('image/png');
  }

  function readMainPriceList() {
    const nodes = document.querySelectorAll('#priceList .chip span');

    return Array.from(nodes).map(node => {
      const raw = (node.textContent || '')
        .replace(/\s*\$/g, '')
        .replace(/\s/g, '')
        .replace(',', '.');

      return Number(raw);
    }).filter(Number.isFinite);
  }

  async function printPrices(values, options) {
    const prices = Array.isArray(values) ? values : [];

    if (!prices.length) {
      throw new Error('La liste ne contient aucun prix.');
    }

    if (state.busy) {
      throw new Error('Une impression est déjà en cours.');
    }

    const driver = await loadDriver();
    checkBluetooth(driver);

    state.busy = true;

    const opts = options || {};
    const density = Math.max(
      1,
      Math.min(5, Number(opts.density) || 3)
    );

    const model = Object.assign({}, MODEL, { density });
    const count = Math.ceil(prices.length / 2);

    try {
      for (let i = 0; i < prices.length; i += 2) {
        setStatus(
          'Impression de l’étiquette ' +
          (Math.floor(i / 2) + 1) + ' sur ' + count + '…'
        );

        const image = makeLabelImage(
          prices[i],
          prices[i + 1],
          opts.fontSize
        );

        await driver.printImage(image, {
          model,
          size: SIZE,
          density
        });
      }

      state.connected = true;
      state.printer = driver.printer || state.printer;

      setStatus('Impression terminée. Vérifie la taille sur papier.');

      return {
        labels: count,
        prices: prices.length
      };

    } finally {
      state.busy = false;
    }
  }

  function addControls() {
    if (document.getElementById('lamb3rtNiimbotCard')) return;

    const main = document.querySelector('main') || document.body;

    const card = document.createElement('section');
    card.id = 'lamb3rtNiimbotCard';
    card.className = 'card';

    card.innerHTML = `
      <h2>4. Imprimante NIIMBOT</h2>

      <p class="hint">
        Connecte la D110_M en Bluetooth et imprime les prix de ta liste.
      </p>

      <div class="actions no-print">
        <button type="button" class="secondary" id="niimbotConnect">
          Connecter la NIIMBOT
        </button>

        <button type="button" class="secondary" id="niimbotDisconnect">
          Déconnecter
        </button>

        <label>
          Densité
          <select id="niimbotDensity">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3" selected>3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>

        <button type="button" class="primary" id="niimbotPrint">
          Imprimer la liste
        </button>
      </div>

      <div id="niimbotStatus" class="hint" role="status">
        Prête. Connexion Bluetooth en attente.
      </div>
    `;

    main.appendChild(card);

    document.getElementById('niimbotConnect')
      .addEventListener('click', async function () {
        this.disabled = true;

        try {
          await connect();
        } catch (error) {
          setStatus('Connexion impossible : ' + error.message);
        } finally {
          this.disabled = false;
        }
      });

    document.getElementById('niimbotDisconnect')
      .addEventListener('click', async function () {
        this.disabled = true;

        try {
          await disconnect();
        } catch (error) {
          setStatus('Déconnexion : ' + error.message);
        } finally {
          this.disabled = false;
        }
      });

    document.getElementById('niimbotPrint')
      .addEventListener('click', async function () {
        this.disabled = true;

        try {
          const prices = readMainPriceList();

          await printPrices(prices, {
            density: document.getElementById('niimbotDensity').value,
            fontSize: 22
          });

        } catch (error) {
          setStatus('Impression interrompue : ' + error.message);
        } finally {
          this.disabled = false;
        }
      });
  }

  window.Lamb3rtImpression = {
    connect,
    disconnect,
    printPrices,
    printCurrentList: () => printPrices(readMainPriceList()),
    getPrinter: () => state.printer,
    getStatus: () => ({
      connected: state.connected,
      busy: state.busy,
      printer: state.printer
    }),
    config: {
      model: MODEL,
      size: SIZE
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addControls, { once: true });
  } else {
    addControls();
  }

})();
