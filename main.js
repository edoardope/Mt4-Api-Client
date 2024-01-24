
async function makeHttpGetRequest(url, body = null) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error making HTTP GET request:', error.message);
      throw error;
    }
}


let connectionString = 'https://prod-29.westeurope.logic.azure.com:443/workflows'

let runHistory = [];

let refreshRate = 60000;

async function StoreCandleData(){

    let body = {
        "function": "GetCurrentCandleData"
    };

    const intervalId = setInterval(async () => {

        let data = await makeHttpGetRequest(connectionString, body);

        obj = {

            "low" : data[0].ep_currentlow,
            "close" : data[0].ep_currentclose,
            "open" : data[0].ep_currentopen,
            "high" : data[0].ep_currenthigh

        }

        runHistory.push(obj)


    }, refreshRate);

}


//StoreCandleData();

let backtestData = [];

function loadBackTestData(){

    console.log('beginning data parse...');

    backtestData = JSON.parse(localStorage.getItem('BackTestData'));;

    console.log(backtestData);

    console.log('done!');

}

function beginBackTest() {
    let candleCounter = 0;
    let validBuyCandlesCounter = 0;
    let validSellCandlesCounter = 0;

    let PosopenPrice = 0;
    let PosclosePrice = 0;
    let positionTaken = false;
    let barInPosition = 0;
    let totalPoints = 0;
    let positionType = '';  // 'buy' o 'sell'

    console.log('BackTest started!');

    backtestData.forEach(candle => {
        candleCounter++;

        let max = candle.high;
        let min = candle.low;
        let totalLength = max - min;
        let oneThird = totalLength / 3;
        let buy = max - oneThird;
        let sell = min + oneThird;
        let openPrice = candle.open;
        let closePrice = candle.close;

        if (positionTaken && barInPosition < 60) {
            barInPosition++;
        } else if (positionTaken && barInPosition == 60) {
            barInPosition = 0;
            positionTaken = false;
            PosclosePrice = closePrice;
            let pointoperation = (positionType === 'buy') ? (PosclosePrice - PosopenPrice) : (PosopenPrice - PosclosePrice);
            totalPoints += pointoperation;
            console.log(`Position closed. Type: ${positionType}, Points: ${pointoperation.toFixed(5)}`);
        }

        // Logica di acquisto
        if (!positionTaken && openPrice <= max && openPrice >= buy && closePrice <= max && closePrice >= buy) {
            validBuyCandlesCounter++;
            positionTaken = true;
            positionType = 'buy';
            PosopenPrice = closePrice;
            console.log(`Candle ${candleCounter} is within buy range.`);
        }

        // Logica di vendita
        if (!positionTaken && openPrice >= min && openPrice <= sell && closePrice >= min && closePrice <= sell) {
            validSellCandlesCounter++;
            positionTaken = true;
            positionType = 'sell';
            PosopenPrice = closePrice;
            console.log(`Candle ${candleCounter} is within sell range.`);
        }
    });

    console.log('BackTest done!');
    console.log('total candle: ' + candleCounter);
    console.log('buy positions: ' + validBuyCandlesCounter);
    console.log('sell positions: ' + validSellCandlesCounter);
    console.log('realised profit: ' + totalPoints.toFixed(5));
}

// Funzione che accetta i cambiamenti di prezzo e il periodo per calcolare l'RSI
function calculateRSI(priceChanges, period) {
    let gains = 0;
    let losses = 0;

    // Calcola la somma dei guadagni e delle perdite
    for (const change of priceChanges) {
        if (change > 0) gains += change; // Guadagno
        else losses -= change; // Perdita (rimuovi il segno negativo)
    }

    // Calcola il guadagno medio e la perdita media
    let averageGain = gains / period;
    let averageLoss = losses / period;

    // Calcola il Relative Strength (RS)
    let relativeStrength = averageLoss === 0 ? 100 : averageGain / averageLoss;

    // Calcola e restituisce l'RSI
    let rsi = 100 - (100 / (1 + relativeStrength));
    return rsi;
}

function beginBackTest2(period) {
    let candleCounter = 0;
    let priceChanges = [];
    let lastClosePrice = backtestData[0].close; // Inizializza con il primo prezzo di chiusura
    
    backtestData.forEach(candle => {
        candleCounter++;
        let closePrice = candle.close;
        let change = closePrice - lastClosePrice;
        priceChanges.push(change);

        // Mantieni solamente i cambiamenti di prezzo per il periodo specificato
        if (priceChanges.length > period) {
            priceChanges.shift(); // Rimuovi il primo elemento se supera il periodo
        }

        // Calcola l'RSI solo se hai abbastanza dati
        if (candleCounter >= period) {
            let rsi = calculateRSI(priceChanges, period);
            console.log(`RSI for candle ${candleCounter}: ${rsi.toFixed(2)}`);
        }

        lastClosePrice = closePrice; // Aggiorna l'ultimo prezzo di chiusura
    });
}

