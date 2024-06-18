const app = require("./index");
const {HttpsError} = require("firebase-functions/v2/https");

module.exports.getUser = (uid) => {
  if (!uid) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  return app.db.collection("users").doc(uid).get();
};
