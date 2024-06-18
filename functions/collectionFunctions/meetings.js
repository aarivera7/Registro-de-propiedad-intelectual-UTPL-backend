const app = require("../index");

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");

const db = app.db;
const sendEmail = require("../mailer");

// Meetings
// Añadir reunión de inicio de registro
// Añadir reunión de revisión de avance
exports.addReviewMeeting = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }
  if (request.data.timeStart < request.data.timeFinish) {
    throw new HttpsError("invalid-argument",
        "The start time must be less than the end time!");
  }
  if (request.data.assistance) {
    throw new HttpsError("invalid-argument",
        "The assistance must be false!");
  }
  if (!request.data.place) {
    throw new HttpsError("invalid-argument", "place is required!",
        {place: request.data.place});
  }
  if (!request.data.modality) {
    throw new HttpsError("invalid-argument", "modality is required!",
        {modality: request.data.modality});
  }
  if (request.data.modality != "Virtual" &&
    request.data.modality != "Presencial") {
    throw new HttpsError("invalid-argument",
        "The modality must be Virtual or Presencial!");
  }

  const userData = db.collection("users").doc(request.auth.uid);

  if ((await userData.get()).data().rol !== "admin") {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const documentRef = db.collection("patents").doc(request.data.id);
  const document = documentRef.get();

  const project = (await document).data();

  const timeStart = Timestamp.fromMillis(request.data.timeStart.seconds * 1000)
      .toDate();
  const timeFinish = Timestamp
      .fromMillis(request.data.timeFinish.seconds * 1000).toDate();
  const strTimeStart = timeStart.getHours() + ":" + timeStart.getMinutes();
  const strTimeFinish = timeFinish.getHours() + ":" + timeFinish.getMinutes();

  let type;
  let step;

  if (request.data.type == "progress-review") {
    type = "progressReviewMeeting";
    step = project.numStep + 1;
  } else if (request.data.type == "final-review") {
    type = "finalReviewMeeting";
    step = project.numStep + 1;
  } else if (request.data.type == "start-registration") {
    db.collection("meetings").doc().set({
      type: type,
      date: Timestamp.now(),
      timeStart: timeStart,
      timeFinish: timeFinish,
      place: request.data.place,
      modality: request.data.modality,
      assistance: false,
    });

    sendEmail(
        request.data.email,
        "Reunion para creación de proyecto de propiedad intelectual",
        {
          title: "REUNION PARA CREACIÓN DE PROYECTO DE PROPIEDAD INTELECTUAL",
          name: project.nameAuthor,
          body: "Le informamos que se ha programado una reunión para la " +
          "creación de su proyecto de propiedad intelectual.",
          items: `<b>Fecha:</b> ${timeStart.getDate()}/
          ${timeStart.getMonth()}/${timeStart.getFullYear()}<br>
          <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}<br>
          <b>Lugar:</b> ${request.data.place}<br>
          <b>Modalidad:</b> ${request.data.modality}<br>`,
        },
    ).catch((error) => {
      throw new HttpsError("internal", "Error sending email!", {error: error});
    });

    /* const mailOptions = {
      from: user.value(),
      to: request.data.email,
      subject: "Reunion para creación de proyecto de propiedad intelectual",
      html:
      `<h1>Reunion para creación de proyecto de propiedad intelectual</h1>
      <pre>
      <b>Fecha: </b>
      ${timeStart.getDate()}/${timeStart.getMonth()}/${timeStart.getFullYear()}
      <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}
      <b>Lugar:</b> ${request.data.place}
      <b>Modalidad: </b> ${request.data.modality}</pre>`,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new HttpsError("internal", "Error sending email!", {error: error});
    }*/

    return {message: "Progress Review Meeting added successfully!"};
  } else {
    throw new HttpsError("invalid-argument",
        "The type must be progress-review or final-review!");
  }

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  const batch = db.batch();

  batch.update(documentRef, {
    [type]: {
      assistance: false,
      timeStart: timeStart,
      timeFinish: timeFinish,
      place: request.data.place,
      modality: request.data.modality,
      date: Timestamp.now(),
    },
    numStep: step,
  });

  const meetingRef = db.collection("meetings").doc();

  batch.set(meetingRef, {
    projectId: request.data.id,
    project: documentRef,
    type: type,
    date: Timestamp.now(),
    timeStart: timeStart,
    timeFinish: timeFinish,
    place: request.data.place,
    modality: request.data.modality,
    assistance: false,
    uid: project.uid,
  });

  await batch.commit();

  const typeWord = type == "progressReviewMeeting" ?
      "revisión de avances" : "revisión final";
  const title = type == "progressReviewMeeting" ?
      "REUNION DE REVISION DE AVANCES" : "REUNION DE REVISION FINAL";

  sendEmail(
      project.email,
      `Reunion de ${typeWord} del proyecto "${project.name}"`,
      {
        title: title,
        name: project.nameAuthor,
        body: "Le informamos que se ha agendado la reunión de" + typeWord +
        ", bajo los siguientes criterios.",
        items: `<b>Nombre de la invensión:</b> ${project.name}<br>
        <b>Fecha:</b> ${timeStart.getDate()}/
        ${timeStart.getMonth()}/${timeStart.getFullYear()}<br>
        <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}<br>
        <b>Modalidad:</b> ${request.data.modality}<br>
        <b>Lugar:</b> ${request.data.place}<br>`,
      },
  ).catch((error) => {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  });

  /* const mailOptions = {
    from: user.value(),
    to: project.email,
    subject: `Reunion para creación de proyecto "${project.name}"`,
    html:
    `<h1>Reunion para revisión de proyecto "${project.name}"</h1>
    <pre>
    <b>Nombre del autor:</b> ${project.nameAuthor}
    <b>Nombre del proyecto:</b> ${project.name}
    <b>Tipo de presentación:</b> ${type}
    <b>Fecha: </b>
    ${timeStart.getDate()}/${timeStart.getMonth()}/${timeStart.getFullYear()}
    <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}
    <b>Lugar:</b> ${request.data.place}
    <b>Modalidad: </b> ${request.data.modality}</pre>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  }*/

  return {message: "Progress Review Meeting added successfully!"};
});

/* const nodemailer = require("nodemailer");
const {defineString} = require("firebase-functions/params");

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
});*/
