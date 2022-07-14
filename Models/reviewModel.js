const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var reviewSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  past: {
    type: String,
    required: true,
  },
  future: {
    type: String,
    required: true,
  },
  issue: {
    type: String,
    required: true,
  },
  improvement: {
    type: String,
    required: true,
  },
});

//Export the model
module.exports = mongoose.model('Review', reviewSchema);