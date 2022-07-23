const mongoose = require('mongoose');

const instaSchema = new mongoose.Schema({
  media_type: {
    type: String,
  },
  permalink: {
    type: String,
  },
  media_url: {
    type: String,
  },
  id: {
    type: Number,
  }
})

module.exports = mongoose.model('Insta', instaSchema);