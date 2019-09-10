const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
const moment = require("moment");

let coinPriceMaps = new Map();

// https://alligator.io/nodejs/req-object-in-expressjs/

/* GET home page. */
router.get("/top-performers", function(req, res, next) {
  // res.render("index", { title: "Express" });
  console.log(req);
  console.log(req.params);
  console.log("DAYS");
  console.log(req.params.days);

  let topPerformers = getTopPerformers(30);
  // res.render("index", topPerformers);
  // res.render(topPerformers);
  // return topPerformers;
  res.json(topPerformers);
});

console.log("index started");

start();

function getTopPerformers(numberOfDays) {
  let percentChanges = [];
  for (const [key, value] of coinPriceMaps.entries()) {
    if (value.length < numberOfDays - 1) {
      // not enough days recorded yet
      continue;
    }

    // For example, if you buy a stock today for $50, and tomorrow the stock is worth $52, your percentage gain is 4% ([$52 - $50] / $50).
    let percentChangeFromToday =
      (value[value.length - 1] - value[value.length - numberOfDays]) /
      value[value.length - numberOfDays];

    let friendlyName = key.split("-");

    let keyPercent = {
      friendlyName: friendlyName[0],
      baseAssetName: key,
      percentChange: (percentChangeFromToday * 100).toFixed(2)
    };

    percentChanges.push(keyPercent);
  }

  // console.log("THIS IS THE FINAL PRINT");
  percentChanges.sort((a, b) => b.percentChange - a.percentChange);

  // for (let i = 0; i < percentChanges.length; i++) {
  //   console.log(percentChanges[i]);
  // }

  console.log("get top performers called ");

  return percentChanges;
}

async function generateCoinPriceMaps() {
  let coinsJson = await axios.get("https://dex.binance.org/api/v1/ticker/24hr");

  for (let i = 0; i < coinsJson.data.length; i++) {
    let prices = [];
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
      } catch (e) {
        console.log("price data does not go back that far - " + path);
      }
    }

    coinPriceMaps.set(coin.baseAssetName, prices);
  }

  getTopPerformers(30);
}

// https://dex.binance.org/api/v1/klines?symbol=FTM-A64_BNB&interval=5m
async function start() {
  let bnbHistoricPriceMap = await getBnbHistoricPriceMap();

  console.log("started");

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
