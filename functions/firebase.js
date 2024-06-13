const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getStorage} = require("firebase-admin/storage");

const app = initializeApp(); // no arguments uses the default service account

exports.app = app;
exports.db = getFirestore(app);
exports.storage = getStorage(app);
