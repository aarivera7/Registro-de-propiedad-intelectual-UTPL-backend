const admin = require("firebase-admin");
const serviceAccount = require("./permissions.json");

const {onCall, HttpsError} = require("firebase-functions/v2/https");

const sendEmail = require("./mailer");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://patentes-utpl/firebaseio.com",
  storageBucket: "patentes-utpl.appspot.com",
});

const db = admin.firestore();
const storage = admin.storage();

exports.db = db;
exports.storage = storage;


const {setGlobalOptions} = require("firebase-functions/v2");
setGlobalOptions({maxInstances: 10});
const functions = require("firebase-functions/v1");

const projects = require("./collections/projects");
const messages = require("./collections/messages");
const meetings = require("./collections/meetings");
const onFirestore = require("./onFirestore");
const onStorage = require("./onStorage");

module.exports = {
  ...projects,
  ...messages,
  ...meetings,
  onFirestore,
  onStorage,
};

// Crea la información de un usuario en la base de datos
module.exports.onCreateUser = functions.auth.user().onCreate(async (user) => {
  const {uid, email, displayName, photoURL, phoneNumber} = user;
  return await db.collection("users").doc(uid).set({
    uid,
    email,
    name: displayName,
    lastName: "",
    photoURL,
    rol: "user",
    phoneNumber,
  });
});


module.exports.requestsForAdvice = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const user = db.collection("users").doc(request.auth.uid);
  const userData = (await user.get()).data();

  if (userData.rol === "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  await sendEmail(
      userData.email,
      "Solicitud de asesoría",
      {
        title: "SOLICITUD DE ASESORÍA",
        name: userData.name + " " + userData.lastName,
        body: "Le informamos que se ha recibido su solicitud con éxito, " +
        "en breves se comunicará la persona encargada de la asesoría " +
        "para la agendación de la reunión.",
        items: "",
      },
  );

  return {message: "Request sent successfully!"};
});
