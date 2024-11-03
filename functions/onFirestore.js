const app = require("./index");

const {HttpsError} = require("firebase-functions/v2/https");
const {onDocumentDeleted, onDocumentUpdated, onDocumentCreated} =
require("firebase-functions/v2/firestore");
const {SafeString} = require("handlebars");

const storage = app.storage;
const db = app.db;
const sendEmail = require("./mailer");


// Eliminar archivos de storage de un proyecto eliminado
exports.onDeleteProject = onDocumentDeleted("projects/{patentId}",
    async (event)=>{
      const snap = event.data;
      const data = snap.data();

      await storage.bucket().deleteFiles({
        prefix: `projects/${data.type}/${snap.id}`,
      });
    });


// Enviar un correo electrónico cuando se cree un projecto
exports.onCreateProject = onDocumentCreated("projects/{projectId}",
    async (event) => {
      const data = event.data.data();

      const user = (await db.collection("users").doc(data.uid).get()).data();

      await sendEmail(
          user.email,
          `Creación del proyecto "${data.name}"`,
          {
            title: `CREACIÓN DE PROYECTO`,
            name: data.nameAuthor,
            body: `Le informamos que se ha creado el proyecto "${data.name}"`,
            items: new SafeString(`<b>Descripción:</b> ${data.description}
              <br><b>Fecha de creación:</b> ${data.createDate.toDate()
      .toLocaleDateString()}
              <br><b>Tipo:</b> ${data.type}  
              `),
          },
      );
    },
);


// Enviar un correo electrónico cuando se actualice un documento
exports.onChangeProject = onDocumentUpdated("projects/{patentId}",
    async (event) => {
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();

      if (beforeData.documents != afterData.documents) {
        for (const document in afterData.documents || {}) {
          if (beforeData.documents && beforeData.documents[document] &&
            afterData.documents[document].observation.trim() != "" && (
            (beforeData.documents[document].observation !=
            afterData.documents[document].observation))) {
            await sendEmail(
                afterData.email,
                `Observaciones del documento "${document}" del 
                proyecto "${afterData.name}"`,
                {
                  title: `REQUISITOS - OBSERVACIONES DEL DOCUMENTO ${document}`,
                  name: afterData.authorName,
                  body: `Le informamos que se HAN REALIZADO OBSERVACIONES en 
                  el siguiente documento del proyecto "${afterData.name}": 
                  ${document}`,
                  items: new SafeString(`<b>Observaciones:</b> 
                  ${afterData.documents[document].observation}`),
                },
            ).catch((error) => {
              throw new HttpsError("internal", "Error sending email!",
                  {error: error});
            });


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


/* Define some parameters
const nodemailer = require("nodemailer");
const {defineString} = require("firebase-functions/params");

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
}; */
