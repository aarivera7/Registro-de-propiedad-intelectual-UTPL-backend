const app = require("../index");

const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");
const {SafeString} = require("handlebars");

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

  const documentRef = db.collection("projects").doc(request.data.id);
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
    step = 3;
  } else if (request.data.type == "final-review") {
    type = "finalReviewMeeting";
    step = project.type == "patent" ? 4 : 2;
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
          items: new SafeString(`<b>Fecha:</b> ${timeStart.getDate()}/
          ${timeStart.getMonth()}/${timeStart.getFullYear()}<br>
          <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}<br>
          <b>Lugar:</b> ${request.data.place}<br>
          <b>Modalidad:</b> ${request.data.modality}<br>`),
        },
    ).catch((error) => {
      throw new HttpsError("internal", "Error sending email!", {error: error});
    });

    return {message: "Progress Review Meeting added successfully!"};
  } else {
    throw new HttpsError("invalid-argument",
        "The type must be progress-review or final-review!");
  }

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  const batch = db.batch();

  let meetingRef;

  if (project[type] && project[type].meetingRef) {
    meetingRef = project[type].meetingRef;
  } else {
    meetingRef = db.collection("meetings").doc();
  }

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

  batch.update(documentRef, {
    [type]: {
      assistance: false,
      timeStart: timeStart,
      timeFinish: timeFinish,
      place: request.data.place,
      modality: request.data.modality,
      date: Timestamp.now(),
      meetingRef: meetingRef,
      meetingId: meetingRef.id,
    },
    numStep: step,
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
        body: "Le informamos que se ha agendado la reunión de" +
        typeWord + ", bajo los siguientes criterios.",
        items: new SafeString(
            `<b>Nombre de la invensión:</b> ${project.name}<br>
        <b>Fecha:</b> ${timeStart.getDate()}/
        ${timeStart.getMonth()}/${timeStart.getFullYear()}<br>
        <b>Hora:</b> ${strTimeStart} - ${strTimeFinish}<br>
        <b>Modalidad:</b> ${request.data.modality}<br>
        <b>Lugar:</b> ${request.data.place}<br>`),
      },
  ).catch((error) => {
    throw new HttpsError("internal", "Error sending email!", {error: error});
  });

  return {message: "Progress Review Meeting added successfully!"};
});


// Confirmar asistencia a reunión

exports.confirmAssistance = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication Required!");
  }

  const meetingRef = db.collection("meetings").doc(request.data.id);
  const meeting = (await meetingRef.get()).data();

  if (!meeting) {
    throw new HttpsError("not-found", "Meeting not found!");
  }

  if (meeting.assistance) {
    throw new HttpsError("already-exists", "The assistance is already true!");
  }

  const projectRef = meeting.project;
  const project = (await projectRef.get()).data();

  if (!project) {
    throw new HttpsError("not-found", "Project not found!");
  }

  if (project.uid !== request.auth.uid) {
    throw new HttpsError("permission-denied",
        "You are not authorized to perform this action!");
  }

  const batch = db.batch();

  batch.update(meetingRef, {
    assistance: true,
  });

  batch.update(projectRef, {
    [meeting.type]: {
      assistance: true,
      timeStart: meeting.timeStart,
      timeFinish: meeting.timeFinish,
      place: meeting.place,
      modality: meeting.modality,
      date: meeting.date,
      meetingRef: meetingRef,
      meetingId: meetingRef.id,
    },
  });

  await batch.commit();

  return {message: "Assistance confirmed successfully!"};
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
