const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const port = process.env.PORT;
const Payment = require("./models/paymentModel"); 

app.listen(port, () => {
  console.log(`app is running at localhost:${port}`);
});

mongoose
  .connect(process.env.MONGO_ATLASS_URL)
  .then(() => console.log("connected to db successfully"))
  .catch((err) => console.log(err));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//STEP 1 getting access token
// app.get("/token", (req, res) => {
//     generateToken();
// })
const generateToken = async (req, res, next) => {
    const secret = process.env.MPESA_CONSUMER_SECRET;
    const consumer = process.env.MPESA_CONSUMER_KEY;
    
    const auth = new Buffer.from(`${consumer}:${secret}`).toString("base64");
    await axios
      .get(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        {
          headers: {
            authorization: `Basic ${auth}`,
          },
        }
      )
      .then((responce) => {
        
    //    console.log(responce.data.access_token)  ;
         token = responce.data.access_token;
        next();
      })
      .catch((err) => {
        console.log(err);
      });
  };

//STEP 2 //stk push
app.post("/stk", generateToken, async (req, res) => {
    const phone = req.body.phone.substring(1); //formated to 72190........
    const amount = req.body.amount;
    
  
    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);
    const shortCode = process.env.MPESA_PAYBILL;
    const passkey = process.env.MPESA_PASSKEY;
  
    // const callbackurl = process.env.CALLBACK_URL;
  
    const password = new Buffer.from(shortCode + passkey + timestamp).toString(
      "base64"
    );
  
    await axios
      .post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
        
        {
          BusinessShortCode: shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: amount,
          PartyA: `254${phone}`,
          PartyB: shortCode,
          PhoneNumber: `254${phone}`,
          CallBackURL: "https://7e15-197-237-32-226.in.ngrok.io/callback",
          AccountReference: "ayub simbaa",
          TransactionDesc: "test",
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
    ) .then((data) => {
        
        console.log(data.data)
        res.status(200).json(data.data)
        })
        .catch((err) => {
            console.log(err.message)
            res.status(400).json(err.message)
          
        });
});

//STEP 3 callback url

app.post("/callback", (req, res) => {
 const callbackData =  req.body;
 console.log(callbackData.Body);
 if (!callbackData.Body.stkCallback.CallbackMetadata) {
    console.log(callbackData.body);
    return res.json("ok");

  }
//   console.log(callbackData.Body.stkCallback.CallbackMetadata);
  const phone = callbackData.Body.stkCallback.CallbackMetadata.Item[4].Value;
  const amount = callbackData.Body.stkCallback.CallbackMetadata.Item[0].Value;
  const trnx_id = callbackData.Body.stkCallback.CallbackMetadata.Item[1].Value;

   // saving the transaction to db
   console.log({
    phone,
    amount,
    trnx_id,
  });
  const payment = new Payment();

 payment.number = phone;
 payment.amount = amount;
 payment.trnx_id = trnx_id;

  payment
    .save()
    .then((data) => {
      console.log({ message: "transaction saved successfully", data });
    })
    .catch((err) => console.log(err.message));

  res.status(200).json("ok");

});
app.post("/stkpushquery", generateToken, async (req, res) => {
    const CheckoutRequestID = req.body.CheckoutRequestID;
  
    const date = new Date();
    const timestamp =
      date.getFullYear() +
      ("0" + (date.getMonth() + 1)).slice(-2) +
      ("0" + date.getDate()).slice(-2) +
      ("0" + date.getHours()).slice(-2) +
      ("0" + date.getMinutes()).slice(-2) +
      ("0" + date.getSeconds()).slice(-2);
    const shortCode = process.env.MPESA_PAYBILL;
    const passkey = process.env.MPESA_PASSKEY;
  
    const password = new Buffer.from(shortCode + passkey + timestamp).toString(
      "base64"
    );
  
    await axios
  
      .post(
        "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
        {
          BusinessShortCode: shortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: CheckoutRequestID,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then((responce) => {
        res.status(200).json(responce.data);
      })
      .catch((err) => {
        console.log(err.message);
        res.status(400).json(err);
      });
  });

app.get("/payment", (req, res) => {
    Payment.find({})
      .sort({ createdAt: -1 })
      .exec(function (err, data) {
        if (err) {
          res.status(400).json(err.message);
        } else {
          res.status(201).json(data);
          // data.forEach((transaction) => {
          //   const firstFour = transaction.customer_number.substring(0, 4);
          //   const lastTwo = transaction.customer_number.slice(-2);
  
          //   console.log(`${firstFour}xxxx${lastTwo}`);
          // });
        }
      });
  });


  
  
  

