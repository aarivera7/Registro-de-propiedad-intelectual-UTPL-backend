const app = require("./index");

const {HttpsError} = require("firebase-functions/v2/https");
const {onDocumentDeleted, onDocumentUpdated} =
require("firebase-functions/v2/firestore");
const {defineString} = require("firebase-functions/params");

const storage = app.storage;
const nodemailer = require("nodemailer");
const sendEmail = require("./mailer");


// Eliminar archivos de storage de un proyecto eliminado
exports.onDeleteProject = onDocumentDeleted("patents/{patentId}",
    async (event)=>{
      const snap = event.data;
      const data = snap.data();

      await storage.bucket().deleteFiles({
        prefix: `projects/${data.type}/${snap.id}`,
      });
    });


// Enviar un correo electrónico cuando se actualice un documento
exports.onChangeProject = onDocumentUpdated("patents/{patentId}",
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      if (beforeData.documents != afterData.documents) {
        for (const document in afterData.documents || {}) {
          if (beforeData.documents && beforeData.documents[document] && (
            (beforeData.documents[document].observation !=
            afterData.documents[document].observation))) {

            await sendEmail(
                afterData.email,
                `Observaciones del documento "${document}" del 
                proyecto "${afterData.name}"`,
                {
                  title: `REQUISITOS - OBSERVACIONES DEL DOCUMENTO ${document}`,
                  name: afterData.authorName,
                  body: `Le informamos que se HAN REALIZADO OBSERVACIONES en el siguiente documento del proyecto "${afterData.name}": ${document}`,
                  items: `<b>Observaciones:</b> ${afterData.documents[document].observation}`
                },
            );


            /* sendEmailTransporter(
                user.value(),
                afterData.email,
                `Observaciones del documento "${document}"`,
                `<h1>Observaciones del documento "${document}"</h1>
                <pre>
                <b>Nombre del autor:</b> ${afterData.nameAuthor}
                <b>Nombre del proyecto:</b> ${afterData.name}
                <b>Observaciones actual:</b>
                ${afterData.documents[document].observation}
                </pre>`,
            );*/
          }
        }
      }
    },
);



// Define some parameters
const user = defineString("USER_EMAIL");
const pass = defineString("PASSWORD_EMAIL");

const transporter = nodemailer.createTransport({
  service: "microsoft",
  host: "smtp.office365.com",
  port: 587,
  tls: {
    ciphers: "SSLv3",
  },
  secureConnection: true,
  auth: {
    user: user.value(),
    pass: pass.value(),
  },
});


const sendEmailTransporter = async (from, to, subject, html) => {
  const mailOptions = {
    from: from,
    to: to,
    subject: subject,
    html: html,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  }
};