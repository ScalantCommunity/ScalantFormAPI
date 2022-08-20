const { cloudinary } = require('./utils/cloudinary');
const nodemailer = require('nodemailer')
const handlebars = require("handlebars");
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const connectDB = require('./utils/db.js');
const User = require('./Models/memberModel.js');
const Review = require('./Models/reviewModel.js');
const Insta = require('./Models/instaModel.js');
const express = require('express');
const app = express();
const axios = require('axios');
const cron = require('node-cron');
const Instagram = require('node-instagram').default;
var randomstring = require("randomstring");


var cors = require('cors');




app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})

connectDB()



//instragram
cron.schedule('0 */3 * * *', async () => {
    try {
        console.log('running a task every three hours');
        const token = await axios.get(process.env.INSTA_API_FETCH)
        let instaAccessToken = token.data; // get from DB
        console.log(token.data)
        let resp = await axios.get(`https://graph.instagram.com/me/media?fields=media_type,permalink,media_url&access_token=${instaAccessToken}`);
        resp = resp.data;
        let instaPhotos = resp.data.filter(d => d.media_type === "IMAGE").map(d => d.media_url);
        // Got insta photos
        await Insta.deleteMany({});
        resp.data.forEach(async d => {
            await Insta.create(d)
        })
    } catch (e) {
        console.log(e.response.data.error);
    }
});



app.get('/api/insta', async (req, res) => {
    const data = await Insta.find({});
    res.send(data);
})


//Date Format
function padTo2Digits(num) {
    return num.toString().padStart(2, '0');
}

function formatDate() {
    return [
        padTo2Digits(new Date().getDate() + 2),
        padTo2Digits(new Date().getMonth() + 1),
        new Date().getFullYear(),
    ].join('/');
}

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

app.get('/bro', (req, res) => {
    // res.download('./templete/Broucher/ScalantBrochure.pdf'))
    var data = fs.readFileSync('./templete/Broucher/ScalantBrochure.pdf');
    res.contentType("application/pdf");
    res.send(data);
})

app.get('/brodownload', (req, res) => {
    res.download('./templete/Broucher/ScalantBrochure.pdf')
})


app.post('/api/getotp', async (req, res) => {
    try {
        generatedOtp = Math.floor(100000 + Math.random() * 900000);
        const { email } = req.body
        console.log(email, 'hello')
        if (email === '') {
            return res.send({ status: false, info: 'Please enter email' })
        }
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
                res.status(201).json({ status: true, info: 'Otp Send' })
            }
        })
        verifiedEmail = email
    }
    catch (err) {
        console.log(err)
        res.status(404).json(err)
    }
})

app.post('/api/verifyotp', async (req, res) => {
    try {
        const { otp } = req.body
        if (otp === '') {
            return res.send({ status: false, info: 'Please enter otp' })
        }
        if (+otp === generatedOtp) {
            return res.send({ status: true, info: 'Otp Verified' })
        } else {
            return res.send({ status: false, info: 'Otp Not Verified' })
        }
    }
    catch (err) {
        console.log(err)
        res.status(404).json(err)
    }
})

app.post('/api/upload', async (req, res) => {
    try {

        const { name, email, domain, linkedin, github, twitter, instagram, phoneNumber, profileImage } = req.body

        const user = await User.findOne({ email })
        if (user) {
            return res.send({ status: false, info: 'User Already Exist' })
        }

        const member = await User.create({ photo: profileImage, name, email, phoneNumber, domain, linkedin, github, twitter, instagram })

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
                res.status(201).json({ status: true, member })
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
    const { name, email, domain, phoneNumber, linkedin, github, twitter, instagram, isTeamMember } = req.body
    const updatedUser = await User.findByIdAndUpdate(id, { name, email, domain, phoneNumber, linkedin, github, twitter, instagram, isTeamMember }, {
        new: true
    })
    res.json({ updatedUser });
})

app.get('/files/:name', (req, res) => {
    const fileName = req.params.name;
    const directoryPath = __dirname + "/images/";
    res.download(directoryPath + fileName, fileName, (err) => {
        if (err) {
            res.status(500).send({
                message: "Could not download the file. " + err,
            });
        }
    });
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

app.get('/api/offer', async (req, res) => {
    const users = await User.find({})

    users.map(async (u) => {
        if (u.email === 'abhishektungala1212@gmail.com') {

            console.log(u)
            const filePath = path.join(__dirname, './templete/offerletter/template/offer.html');
            const source = fs.readFileSync(filePath, 'utf-8').toString();
            const template = handlebars.compile(source);
            const replacements = {
                linktoform: `https://scalant.in/tnc`,
                date: formatDate()
            };
            const htmlToSend = template(replacements);

            let mailOptions = {
                from: process.env.USER_ID,
                to: u.email,
                subject: `Welcome Letter from Scalant`,
                html: htmlToSend,
                attachments: [
                    {
                        filename: `${u.name.split(' ')[0]}.pdf`,
                        path: path.join(__dirname, `./templete/offerletter/${u.name.split(' ')[0]}.pdf`),
                        contentType: 'application/pdf',
                    },
                ]
            }


            await transporter.sendMail(mailOptions, function (err, info) {
                if (err) {
                    console.log(err)
                } else {
                    console.log(`email sent to- ${u.name} on ${u.email}`)
                }
            })


        }
    })

    res.send(users)
})

app.post('/api/imgupload', async (req, res) => {
    const name = randomstring.generate(7) + '.png';
    console.log(req.headers)
    const baseurl = `https://${req.headers.host}/files`
    const { data } = req.body
    let base64Data = data.replace(/^data:image\/png;base64,/, "");
    base64Data += base64Data.replace('+', ' ');
    binaryData = new Buffer(base64Data, 'base64').toString('binary');

    await fs.writeFile(`./images/${name}`, binaryData, "binary", function (err) {
        console.log(err); // writes out file without error, but it's not a valid image
    });
    res.send(baseurl + `/${name}`);
})


app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body

    let mailOptions = {
        from: process.env.USER_ID,
        to: 'scalantofficial@gmail.com',
        subject: `Contact Mail`,
        text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
    }


    await transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err)
            res.status(500).json({ err });
        } else {
            console.log(`email sent`)
            res.status(201).json({ success: true, info: 'Mail Sent' })
        }
    })

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


// //whatsapp bot
// const client = new Client({ puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }, authStrategy: new LocalAuth() });

// client.on("qr", (qr) => {
//     console.log(qr)
//     qrcode.generate(qr, { small: true });
// });



// client.on("ready", () => {

//     console.log("Client is ready!");
//     client.sendMessage('919119346007@c.us', 'hello')
// });

// app.post('/api/whatsappOtp', async (req, res) => {
//     const { phoneNumber } = req.body
//     generatedWhatsappOtp = Math.floor(100000 + Math.random() * 900000);


//     const sanitized_number = phoneNumber.toString().replace(/[- )(]/g, ""); // remove unnecessary chars from the number
//     const final_number = `91${sanitized_number.substring(sanitized_number.length - 10)}`; // add 91 before the number here 91 is country code of India

//     const number_details = await client.getNumberId(final_number); // get mobile number details

//     if (number_details) {
//         const sendMessageData = await client.sendMessage(number_details._serialized, `Otp For Whatsapp Verification is ${generatedWhatsappOtp}`); // send message
//     } else {
//         console.log(final_number, "Mobile number is not registered");
//         return res.status(401).json({ err: 'Mobile number not registered', phoneNumber: final_number });
//     }

//     res.json({ status: 'complete' })
// })

// client.initialize();

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log('listening on 3001');
});
