const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
const moment = require("moment");

let coinPriceMaps = new Map();

router.get("/", function(req, res, next) {
  let topPerformers = getBaseCoinMetrics();
  let tableHeaders = getTableHeaders(topPerformers);
  res.render("index", {
    title: "Express",
    tableHeaders: tableHeaders,
    topPerformers: topPerformers
  });
});

router.get("/api/performance", function(req, res, next) {
  let topPerformers = getBaseCoinMetrics();
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.json(topPerformers);
});

start();

function getTableHeaders(coinMetrics) {
  const keys = Object.keys(coinMetrics[0]);
  console.log(keys);
  return keys;
}

function getBaseCoinMetrics() {
  let coinMetrics = [];
  for (const [key, value] of coinPriceMaps.entries()) {
    let coinPrices = value.prices;
    let assetVolumes = value.assetVolumes;
    let numberOfTrades = value.numberOfTrades;
    let thirtyDayPerformance = getPerformaceOverDays(30, coinPrices);
    let sevenDayPerformance = getPerformaceOverDays(7, coinPrices);
    // let threeDayPerformance = getPerformaceOverDays(3, coinPrices);
    let fourteenDayPerformance = getPerformaceOverDays(14, coinPrices);
    let oneDayPerformance = getPerformaceOverDays(1, coinPrices);
    let thirtyDayMarketVolume = getMarketVolume(30, assetVolumes);
    let oneDayMarketVolume = getMarketVolume(1, assetVolumes);
    let thirtyDayNumberOfTrades = getNumberOfTrades(30, numberOfTrades);
    let oneDayNumberOfTrades = getNumberOfTrades(1, numberOfTrades);

    // console.log(key);
    if (key === "FTM-A64") {
      console.log("DEBUG");
      let percentChangeFromToday =
        (parseFloat(coinPrices[coinPrices.length - 1]) -
          parseFloat(coinPrices[coinPrices.length - 14])) /
        parseFloat(coinPrices[coinPrices.length - 14]);

      console.log(parseFloat(coinPrices[coinPrices.length - 1]));
      console.log(parseFloat(coinPrices[coinPrices.length - 14]));

      console.log(percentChangeFromToday);
    }

    let friendlyName = key.split("-");

    let coinMetric = {
      friendlyName: friendlyName[0],
      baseAssetName: key,
      oneDayPerformance: oneDayPerformance,
      // threeDayPerformance: threeDayPerformance,
      sevenDayPerformance: sevenDayPerformance,
      fourteenDayPerformance: fourteenDayPerformance,
      thirtyDayPercentChange: thirtyDayPerformance,
      thirtyDayMarketVolume: Math.round(thirtyDayMarketVolume),
      oneDayMarketVolume: Math.round(oneDayMarketVolume),
      thirtyDayNumberOfTrades: thirtyDayNumberOfTrades,
      oneDayNumberOfTrades: oneDayNumberOfTrades
    };

    coinMetrics.push(coinMetric);
  }

  return coinMetrics;
}

function getMarketVolume(numberOfDays, coinData) {
  return additive(numberOfDays, coinData);
}

function getNumberOfTrades(numberOfDays, coinData) {
  return additive(numberOfDays, coinData);
}

function additive(numberOfDays, coinData) {
  let marketVolume = 0;
  let counter = 0;
  for (let i = coinData.length - 1; i >= 0; i--) {
    marketVolume += coinData[i];
    counter++;
    if (counter === numberOfDays) {
      return marketVolume;
    }
  }

  return marketVolume;
}

function getPerformaceOverDays(numberOfDays, coinData) {
  let percentChangeFromToday = -999;
  if (coinData.length < numberOfDays - 1) {
    // not enough days recorded yet
    return percentChangeFromToday;
  }

  percentChangeFromToday =
    (parseFloat(coinData[coinData.length - 1]) -
      parseFloat(coinData[coinData.length - numberOfDays])) /
    parseFloat(coinData[coinData.length - numberOfDays]);
  return (percentChangeFromToday * 100).toFixed(2);
}

async function generateCoinPriceMaps() {
  let coinsJson = await axios.get("https://dex.binance.org/api/v1/ticker/24hr");

  for (let i = 0; i < coinsJson.data.length; i++) {
    let prices = [];
    let assetVolume = [];
    let numberOfTrades = [];
    let coin = coinsJson.data[i];

    if (coin.baseAssetName === "BNB" || coin.baseAssetName === "BTCB-1DE") {
      continue;
    }

    let workingDate = new moment();
    for (let i = 30; i > 0; i--) {
      workingDate.subtract(1, "days");
      let path = getFilePath(workingDate, coin.baseAssetName);

      try {
        let dayData = JSON.parse(fs.readFileSync(path, "utf-8"));
        prices.unshift(dayData.usdPrice);
        assetVolume.unshift(parseFloat(dayData.assetVolume));
        numberOfTrades.unshift(parseInt(dayData.numberOfTrades));
      } catch (e) {
        console.log("price data does not go back that far - " + path);
      }
    }

    coinPriceMaps.set(coin.baseAssetName, {
      prices: prices,
      assetVolumes: assetVolume,
      numberOfTrades: numberOfTrades
    });
  }

  let bnbPricesMap = await getBnbHistoricPriceMap();

  // now do bnb
  let bnbPrices = [];
  let bnbAssetVolume = [];
  let bnbNumberOfTrades = [];
  let workingDate = new moment();
  for (let i = 30; i > 0; i--) {
    workingDate.subtract(1, "days");
    let year = workingDate.format("YYYY");
    let month = workingDate.format("MM");
    let d = workingDate.format("DD");

    let bnbPriceOnDay = bnbPricesMap.get(year + "-" + month + "-" + d);
    bnbPrices.unshift(bnbPriceOnDay);
    bnbAssetVolume.unshift(parseFloat(0));
    bnbNumberOfTrades.unshift(parseInt(0));
  }

  coinPriceMaps.set("BNB", {
    prices: bnbPrices,
    assetVolumes: bnbAssetVolume,
    numberOfTrades: bnbNumberOfTrades
  });
}

// https://dex.binance.org/api/v1/klines?symbol=FTM-A64_BNB&interval=5m
async function start() {
  let bnbHistoricPriceMap = await getBnbHistoricPriceMap();

  console.log("Performance Data Compute Started");

  let coinsJson = await axios.get("https://dex.binance.org/api/v1/ticker/24hr");

  for (let i = 0; i < coinsJson.data.length; i++) {
    let coin = coinsJson.data[i];
    let today = new moment();

    if (
      !doesDateExist(today.subtract(1, "days"), coin.baseAssetName) &&
      coin.baseAssetName !== "BNB" &&
      coin.baseAssetName !== "BTCB-1DE"
    ) {
      let result = await axios.get(
        "https://dex.binance.org/api/v1/klines?symbol=" +
          coin.baseAssetName +
          "_BNB&interval=1d"
      );

      console.log("Saving coin info for: " + coin.baseAssetName);
      saveCoinInfo(coin.baseAssetName, result.data, bnbHistoricPriceMap);
      msleep(3000);
    }
  }

  console.log("\n\n FINISHED WITH SAVING TO DISK! \n\n");

  await generateCoinPriceMaps();

  console.log("\n\n FINISHED WITH CREATING MAPS! \n\n");
}

async function getBnbHistoricPriceMap() {
  let bnbHistoricPriceMap = new Map();
  let coinMarketCapHistoricData = JSON.parse(
    fs.readFileSync("bnbHistoricPrice.json", "utf-8")
  );

  let bnbTusd = await axios.get(
    "https://dex.binance.org/api/v1/klines?symbol=BNB_TUSDB-888&interval=1d"
  );

  // This only has recent price data
  for (let i = 0; i < bnbTusd.data.length; i++) {
    let bnbDay = moment(parseInt(bnbTusd.data[i][0]));
    let year = bnbDay.format("YYYY");
    let month = bnbDay.format("MM");
    let day = bnbDay.format("DD");
    bnbHistoricPriceMap.set(
      year + "-" + month + "-" + day,
      parseFloat(bnbTusd.data[i][1])
    );
  }

  for (let i = 0; i < coinMarketCapHistoricData.length; i++) {
    let dayMoment = moment(coinMarketCapHistoricData[i].date);
    let year = dayMoment.format("YYYY");
    let month = dayMoment.format("MM");
    let day = dayMoment.format("DD");
    if (!bnbHistoricPriceMap.has(year + "-" + month + "-" + day)) {
      bnbHistoricPriceMap.set(
        year + "-" + month + "-" + day,
        coinMarketCapHistoricData[i].open
      );
    }
  }
  return bnbHistoricPriceMap;
}

function getFilePath(date, baseAssetName) {
  let year = date.format("YYYY");
  let month = date.format("MM");
  let day = date.format("DD");

  // 2019-09-04-ftm-a64
  let path =
    "./pricehistory/" +
    year +
    "-" +
    month +
    "-" +
    day +
    "-" +
    baseAssetName.toLowerCase() +
    ".json";

  return path;
}

function doesDateExist(date, baseAssetName) {
  const path = getFilePath(date, baseAssetName);
  try {
    if (fs.existsSync(path)) {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.error(err);
  }
}

// https://docs.binance.org/api-reference/dex-api/paths.html#apiv1klines

// [
//   1499040000000,      // Open time
//   "0.01634790",       // Open
//   "0.80000000",       // High
//   "0.01575800",       // Low
//   "0.01577100",       // Close
//   "148976.11427815",  // Volume
//   1499644799999,      // Close time
//   "2434.19055334",    // Quote asset volume
//   308                // Number of trades
// ]

function saveCoinInfo(baseAssetName, historicPrice, bnbHistoricPriceMap) {
  for (let i = 0; i < historicPrice.length; i++) {
    let historicPriceDay = historicPrice[i];

    let day = moment(parseInt(historicPriceDay[0]));

    if (!doesDateExist(day, baseAssetName)) {
      let filePath = getFilePath(day, baseAssetName);

      let year = day.format("YYYY");
      let month = day.format("MM");
      let d = day.format("DD");

      let usdPrice = bnbHistoricPriceMap.get(year + "-" + month + "-" + d);

      let dayObject = {
        openTime: historicPriceDay[0],
        open: historicPriceDay[1],
        high: historicPriceDay[2],
        low: historicPriceDay[3],
        close: historicPriceDay[4],
        volume: historicPriceDay[5],
        closeTime: historicPriceDay[6],
        assetVolume: historicPriceDay[7],
        numberOfTrades: historicPriceDay[8],
        usdOpenPrice: usdPrice * parseFloat(historicPriceDay[1]),
        usdPrice:
          (usdPrice *
            (parseFloat(historicPriceDay[1]) +
              parseFloat(historicPriceDay[4]))) /
          2,
        bnbPrice: bnbHistoricPriceMap.get(year + "-" + month + "-" + d)
      };

      let stream = fs.createWriteStream(filePath);
      stream.once("open", function(fd) {
        stream.write(JSON.stringify(dayObject));
        stream.end();
      });
    }
  }
}

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

module.exports = router;
