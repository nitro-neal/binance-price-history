const express = require("express");
const router = express.Router();
const axios = require("axios");
const fs = require("fs");
const moment = require("moment");
// const historicBnbPriceData = require("./bnb-historic-price.json");
// import sdfas from ("")
// var someObject = require('./somefile.json')
// import axios from "axios";

/* GET home page. */
router.get("/", function(req, res, next) {
  res.render("index", { title: "Express" });
});

start();

async function start() {
  let bnbHistoricPriceMap = getBnbHistoricPriceMap();
  // https://dex.binance.org/api/v1/klines?symbol=FTM-A64_BNB&interval=5m
  console.log("started");
  // writeFile();

  let coinsJson = await axios.get("https://dex.binance.org/api/v1/ticker/24hr");

  // for (let i = 0; i < coinsJson.data.length; i++) {
  //   let coin = coinsJson.data[i];
  //   console.log(new moment().day());
  //   console.log(moment().format("YYYY-MM-DD"));
  //   console.log(coin);
  //   console.log(coin.baseAssetName);
  //   // msleep(3000);

  //   let today = new moment();

  //   if (doesDateExist(today, coin.baseAssetName)) {
  //     // file is saved already
  //   } else {
  //     let result = await axios.get(
  //       "https://dex.binance.org/api/v1/klines?symbol=" +
  //         coin.baseAssetName +
  //         "_BNB&interval=1d"
  //     );

  //     saveCoinInfo(coin.baseAssetName, result.data);
  //     msleep(3000);
  //   }
  // }
}

async function getBnbHistoricPriceMap() {
  let bnbHistoricPriceMap = new Map();

  let bnbTusd = await axios.get(
    "https://dex.binance.org/api/v1/klines?symbol=BNB_TUSDB-888&interval=1d"
  );

  for (let i = 0; i < bnbTusd.data.length; i++) {
    let bnbDay = moment(parseInt(bnbTusd.data[i][0]));
    let year = bnbDay.format("YYYY");
    let month = bnbDay.format("MM");
    let day = bnbDay.format("DD");
    bnbHistoricPriceMap.set(year + "-" + month + "-" + day, bnbTusd.data[i][1]);
    console.log(
      year + "-" + month + "-" + day + " -----> " + bnbTusd.data[i][1]
    );
  }

  // console.log(historicBnbPriceData);
  let coinMarketCapHistoricData = JSON.parse(
    fs.readFileSync("bnbHistoricPrice.json", "utf-8")
  );

  console.log(coinMarketCapHistoricData);

  // for(coinMarketCapHistoricData) {
  //   bnbHistoricPriceMap.set(year + "-" + month + "-" + day, bnbTusd.data[i][1]);
  // }
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

function saveCoinInfo(baseAssetName, historicPrice) {
  // https://docs.binance.org/api-reference/dex-api/paths.html#apiv1klines
  // [ 1567468800000,
  //   '0.00621742',
  //   '0.00627680',
  //   '0.00608650',
  //   '0.00620718',
  //   '482934.00000000',
  //   1567555199999,
  //   '2997.38388808',
  //   1166 ]

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

  for (let i = 0; i < historicPrice.length; i++) {
    let historicPriceDay = historicPrice[i];

    let day = moment(parseInt(historicPriceDay[0]));

    console.log(day.format("YYYY-MM-DD"));

    if (!doesDateExist(day, baseAssetName)) {
      let filePath = getFilePath(day, baseAssetName);

      let dayObject = {
        openTime: historicPriceDay[0],
        open: historicPriceDay[1],
        high: historicPriceDay[2],
        low: historicPriceDay[3],
        close: historicPriceDay[4],
        volume: historicPriceDay[5],
        closeTime: historicPriceDay[6],
        assetVolume: historicPriceDay[7],
        numberOfTrades: historicPriceDay[8]
      };

      let stream = fs.createWriteStream(filePath);
      stream.once("open", function(fd) {
        stream.write(JSON.stringify(dayObject));
        stream.end();
      });
    }

    // console.log(historicPriceDay);
    //historicPric
    //doesDateExist()
  }

  // let path = getFilePath(date, baseAssetName);

  // console.log("The file was saved!");

  // let stream = fs.createWriteStream("./pricehistory/my_file.txt");
  // stream.once("open", function(fd) {
  //   stream.write("My first row\n");
  //   stream.write("My second row\n");
  //   stream.end();
  // });
}

function msleep(n) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
}

module.exports = router;
