const { cloudinary } = require('./utils/cloudinary');
const nodemailer = require('nodemailer')
const handlebars = require("handlebars");
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const connectDB = require('./utils/db.js');
const User = require('./Models/memberModel.js');
const express = require('express');
const app = express();
var cors = require('cors');


app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

connectDB()

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_ID,
        pass: process.env.GMAIL_PASSWORD
    }
})

let generatedOtp;
let verifiedEmail = '';



app.get('/api/images', async (req, res) => {
    const members = await User.find({});
    console.log(members)
    res.json(members)
});

app.post('/api/getotp', async (req, res) => {
    try {
        generatedOtp = Math.floor((Math.random() * 1000000) + 54);
        const { email } = req.body
        console.log(email, 'hello')
        let mailOptions = {
            from: process.env.USER_ID,
            to: email,
            subject: 'Let\' get you verified!!',
            html: `Your OTP For Verification is ${generatedOtp}`,
        }
        await transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
                return res.json(err)
            } else {
                res.status(201).json({ info: 'Otp Send' })
            }
        })
        verifiedEmail = email
    }
    catch (err) {
        console.log(err)
        res.status(404).json(err)
    }
})

app.post('/api/upload', async (req, res) => {
    try {
        const fileStr = req.body.data;
        const { name, email, domain, linkedin, github, twitter, instagram, otp } = req.body
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            upload_preset: 'dev_setups',
        });

        if (+otp !== generatedOtp) {
            return res.status(400).json({ err: 'OTP Not verified!' })
        }

        if (verifiedEmail !== email) {
            return res.status(400).json({ err: 'Cannot change the email after verification!' })
        }

        const member = await User.create({ photo: uploadResponse.url, name, email, domain, linkedin, github, twitter, instagram })

        const filePath = path.join(__dirname, './templete/email.html');
        const source = fs.readFileSync(filePath, 'utf-8').toString();
        const template = handlebars.compile(source);
        const replacements = {
            username: name.toUpperCase()
        };
        const htmlToSend = template(replacements);

        let mailOptions = {
            from: process.env.USER_ID,
            to: email,
            subject: 'Welcome to the Community!',
            html: htmlToSend
        }


        await transporter.sendMail(mailOptions, function (err, info) {
            if (err) {
                return res.json(err)
            } else {
                console.log(member)
                res.status(201).json(member)
            }
        })



    } catch (err) {
        console.error(err);
        res.status(500).json({ err: 'Something went wrong' });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log('listening on 3001');
});
