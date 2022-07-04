const { cloudinary } = require('./utils/cloudinary');
const nodemailer = require('nodemailer')
const handlebars = require("handlebars");
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();
const connectDB = require('./utils/db.js');
const User = require('./Models/memberModel.js');
const Review = require('./Models/reviewModel.js');
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
let generatedWhatsappOtp;
let verifiedEmail = '';



app.get('/api/images', async (req, res) => {
    const members = await User.find({});
    console.log(members)
    res.json(members)
});

app.post('/api/getotp', async (req, res) => {
    try {
        generatedOtp = Math.floor(100000 + Math.random() * 900000);
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
        const { name, email, domain, linkedin, github, twitter, instagram, otp, whatsappOtp, phoneNumber } = req.body
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            upload_preset: 'dev_setups',
        });
        console.log(whatsappOtp, generatedWhatsappOtp)
        if (+otp !== generatedOtp) {
            return res.status(400).json({ err: 'Email OTP Not verified!' })
        }
        if (+whatsappOtp !== generatedWhatsappOtp) {
            return res.status(400).json({ err: 'Whatsapp OTP Not verified!' })
        }

        if (verifiedEmail !== email) {
            return res.status(400).json({ err: 'Cannot change the email after verification!' })
        }

        const member = await User.create({ photo: uploadResponse.url, name, email, phoneNumber, domain, linkedin, github, twitter, instagram })

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

app.get('/api/user/:id', async (req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);
    res.status(200).json({ user })
})

app.put('/api/user/:id', async (req, res) => {
    const id = req.params.id;
    const { name, email, domain, linkedin, github, twitter, instagram, isTeamMember } = req.body
    const updatedUser = await User.findByIdAndUpdate(id, { name, email, domain, linkedin, github, twitter, instagram, isTeamMember }, {
        new: true
    })
    res.json({ updatedUser });
})

app.get('/api/review', async (req, res) => {
    const users = await User.find({})

    users.map(async (u) => {
        if (u.isTeamMember) {


            const filePath = path.join(__dirname, './templete/review/SCALANT.html');
            const source = fs.readFileSync(filePath, 'utf-8').toString();
            const template = handlebars.compile(source);
            const replacements = {
                username: u.name.toUpperCase(),
                linktoform: `https://review.scalant.in/review/${u._id}`,
            };
            const htmlToSend = template(replacements);

            let mailOptions = {
                from: process.env.USER_ID,
                to: u.email,
                subject: 'Review Form',
                html: htmlToSend,
            }


            await transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log(err)
                } else {
                    console.log('done')
                }
            })


        }
    })

    res.send(users)
})

app.get('/api/review/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const user = await User.findById(id);
        res.send(user)
    }
    catch (error) {
        console.log('error')
        res.json({ error: 'user not found' })
    }
})



app.post('/api/review', async (req, res) => {
    const { name, email, past, future, issue, improvement } = req.body

    const memberReview = await Review.create({ name, email, past, future, issue, improvement })
    res.send(memberReview)
})

app.delete('/api/user/:id', async (req, res) => {
    const id = req.params.id;
    const deletedUser = await User.findByIdAndDelete(id)
    res.json({ deletedUser })
})

app.get('/api/allreviews', async (req, res) => {
    const reviews = await Review.find({})
    let reviewUsers = reviews.map(r => r.name);
    const reviewSet = new Set([...reviewUsers]);
    console.log(reviewSet);
    reviewUsers = [...reviewSet]
    res.send({ reviewUsers });

})



const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log('listening on 3001');
});

//whatsapp bot
const client = new Client();

client.on("qr", (qr) => {
    qrcode.generate(qr, { small: true });
});



client.on("ready", () => {

    console.log("Client is ready!");
    client.sendMessage('919119346007@c.us', 'hello')
});

app.post('/api/whatsappOtp', async (req, res) => {
    const { phoneNumber } = req.body
    generatedWhatsappOtp = Math.floor(100000 + Math.random() * 900000);


    const sanitized_number = phoneNumber.toString().replace(/[- )(]/g, ""); // remove unnecessary chars from the number
    const final_number = `91${sanitized_number.substring(sanitized_number.length - 10)}`; // add 91 before the number here 91 is country code of India

    const number_details = await client.getNumberId(final_number); // get mobile number details

    if (number_details) {
        const sendMessageData = await client.sendMessage(number_details._serialized, `Otp For Whatsapp Verification is ${generatedWhatsappOtp}`); // send message
    } else {
        console.log(final_number, "Mobile number is not registered");
        return res.status(401).json({ err: 'Mobile number not registered', phoneNumber: final_number });
    }

    res.json({ status: 'complete' })
})




client.on("message", (message) => {
    if (message.body.toLowerCase() === "!getscalantusers") {
        const fetchUsers = async () => {
            const { data } = await axios.get('https://scalantformapi-dishant5570-gmailcom-scalant.vercel.app/api/images');
            const users = data.map(user => user.name);
            message.reply(`Members are:\n ${users.map(u => `${u}\n`).toString().replaceAll(',', ' ')}`);
        }
        fetchUsers()
    }
});




client.initialize()