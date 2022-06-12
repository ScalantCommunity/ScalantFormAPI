const { cloudinary } = require('./utils/cloudinary');
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

app.get('/api/images', async (req, res) => {
    const members = await User.find({});
    console.log(members)
    res.json(members)
});
app.post('/api/upload', async (req, res) => {
    try {
        const fileStr = req.body.data;
        const { name, email, domain, linkedin, github, twitter, instagram } = req.body
        const uploadResponse = await cloudinary.uploader.upload(fileStr, {
            upload_preset: 'dev_setups',
        });
        const member = await User.create({ photo: uploadResponse.url, name, email, domain, linkedin, github, twitter, instagram })
        console.log(member)
        res.status(201).json(member)

    } catch (err) {
        console.error(err);
        res.status(500).json({ err: 'Something went wrong' });
    }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log('listening on 3001');
});
