/* =========================================================
   FIREBASE
========================================================= */

import {
    initializeApp
} from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import {
    getFirestore,
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc
} from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyCKMeyABL01rsQ-FcLAn81QO5TvSdxSFjU",

    authDomain:
        "othets-1aa03.firebaseapp.com",

    projectId:
        "othets-1aa03",

    storageBucket:
        "othets-1aa03.firebasestorage.app",

    messagingSenderId:
        "528392191591",

    appId:
        "1:528392191591:web:1e97790e6f9f0a6e175ec2",

    measurementId:
        "G-F50WVZRXZJ"
};


const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


/* =========================================================
   СОСТОЯНИЕ
========================================================= */

let students = [];

let settings = {};

let attendance = {};

let selectedDate = "";

let selectedStudent = null;

let selectedLesson = null;

let selectedAction = null;

let quickMode = null;

let selectedAbsenceType = "disrespectful";


/* =========================================================
   ДНИ НЕДЕЛИ
========================================================= */

const days = [

    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"

];


const dayNames = [

    "Воскресенье",
    "Понедельник",
    "Вторник",
    "Среда",
    "Четверг",
    "Пятница",
    "Суббота"

];


/* =========================================================
   DOM
========================================================= */

const datePicker =
    document.getElementById("datePicker");

const tableContainer =
    document.getElementById("tableContainer");


/* =========================================================
   ДАТА
========================================================= */

function formatDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function formatDateRu(dateString) {

    if (!dateString) {
        return "—";
    }

    const parts =
        dateString.split("-");

    if (parts.length !== 3) {
        return dateString;
    }

    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}


function parseDate(dateString) {

    if (!dateString) {
        return new Date();
    }

    const parts =
        dateString.split("-");

    if (parts.length !== 3) {
        return new Date(dateString);
    }

    return new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );
}


/* =========================================================
   ДЕНЬ НЕДЕЛИ
========================================================= */

function getDayIndex(dateString) {

    const date =
        parseDate(dateString);

    const jsDay =
        date.getDay();

    /*
       Воскресенье = 0
       Понедельник = 1

       Наш массив начинается
       с понедельника.
    */

    if (jsDay === 0) {
        return -1;
    }

    return jsDay - 1;
}


function getDayName(dateString) {

    const date =
        parseDate(dateString);

    return dayNames[
        date.getDay()
    ];
}


/* =========================================================
   ПОЛУЧЕНИЕ КОЛИЧЕСТВА ПАР
========================================================= */

function getLessonCount(dayIndex) {

    if (
        !settings ||
        !settings.schedule
    ) {
        return 0;
    }


    const day =
        days[dayIndex];


    const schedule =
        settings.schedule;


    let value =
        schedule[day];


    /*
       Если расписание хранится
       по числовому индексу.
    */

    if (
        value === undefined &&
        schedule[dayIndex] !== undefined
    ) {
        value =
            schedule[dayIndex];
    }


    /*
       Массив пар
    */

    if (Array.isArray(value)) {

        return value.length;

    }


    /*
       Объект lessons
    */

    if (
        value &&
        Array.isArray(value.lessons)
    ) {

        return value.lessons.length;

    }


    /*
       count
    */

    if (
        value &&
        value.count !== undefined
    ) {

        return Number(value.count) || 0;

    }


    /*
       Если сразу число
    */

    if (
        typeof value === "number"
    ) {

        return value;

    }


    /*
       Если число в строке
    */

    if (
        typeof value === "string" &&
        !isNaN(Number(value))
    ) {

        return Number(value);

    }


    return 0;
}


/* =========================================================
   КОНФИГУРАЦИЯ ПАРЫ
========================================================= */

function firstValue(object, keys) {

    if (!object) {
        return undefined;
    }


    for (const key of keys) {

        if (
            object[key] !== undefined &&
            object[key] !== null &&
            object[key] !== ""
        ) {

            return object[key];

        }

    }


    return undefined;
}


function getLessonConfig(dayIndex, lesson) {

    const day =
        days[dayIndex];


    let config = {};


    /*
       settings.lessons
    */

    if (
        settings.lessons &&
        !Array.isArray(settings.lessons)
    ) {

        const lessonData =
            settings.lessons[lesson];

        if (lessonData) {

            if (
                typeof lessonData === "object"
            ) {

                config = {
                    ...config,
                    ...lessonData
                };

            }

        }

    }


    /*
       settings.scheduleDetails
    */

    if (settings.scheduleDetails) {

        const dayData =
            settings.scheduleDetails[day];

        if (
            Array.isArray(dayData) &&
            dayData[lesson - 1]
        ) {

            config = {
                ...config,
                ...dayData[lesson - 1]
            };

        }

        else if (
            dayData &&
            dayData[lesson]
        ) {

            const item =
                dayData[lesson];

            if (
                typeof item === "object"
            ) {

                config = {
                    ...config,
                    ...item
                };

            }

        }

    }


    /*
       disciplines
    */

    if (settings.disciplines) {

        const disciplineData =
            settings.disciplines[day];

        if (
            Array.isArray(disciplineData)
        ) {

            const value =
                disciplineData[lesson - 1];

            if (
                typeof value === "string"
            ) {

                config.discipline =
                    value;

            }

            else if (
                value &&
                typeof value === "object"
            ) {

                config = {
                    ...config,
                    ...value
                };

            }

        }

        else if (
            disciplineData &&
            typeof disciplineData === "object"
        ) {

            const value =
                disciplineData[lesson];

            if (
                typeof value === "string"
            ) {

                config.discipline =
                    value;

            }

            else if (
                value &&
                typeof value === "object"
            ) {

                config = {
                    ...config,
                    ...value
                };

            }

        }

    }


    /*
       subjects
    */

    if (settings.subjects) {

        const subjectData =
            settings.subjects[day];

        if (
            Array.isArray(subjectData)
        ) {

            const value =
                subjectData[lesson - 1];

            if (
                typeof value === "string"
            ) {

                config.subject =
                    value;

            }

            else if (
                value &&
                typeof value === "object"
            ) {

                config = {
                    ...config,
                    ...value
                };

            }

        }

    }


    /*
       schedule
    */

    if (settings.schedule) {

        const scheduleDay =
            settings.schedule[day];


        if (
            Array.isArray(scheduleDay)
        ) {

            const value =
                scheduleDay[lesson - 1];

            if (
                typeof value === "string"
            ) {

                config.discipline =
                    value;

            }

            else if (
                value &&
                typeof value === "object"
            ) {

                config = {
                    ...config,
                    ...value
                };

            }

        }

    }


    return config;
}


/* =========================================================
   ДИСЦИПЛИНА
========================================================= */

function getDiscipline(dayIndex, lesson) {

    const config =
        getLessonConfig(
            dayIndex,
            lesson
        );


    const discipline =
        firstValue(
            config,
            [
                "discipline",
                "subject",
                "name",
                "title",
                "lessonName"
            ]
        );


    if (discipline) {
        return discipline;
    }


    return "Дисциплина не настроена";
}


/* =========================================================
   ВРЕМЯ ПАРЫ
========================================================= */

function getLessonTime(dayIndex, lesson) {

    const config =
        getLessonConfig(
            dayIndex,
            lesson
        );


    const start =
        firstValue(
            config,
            [
                "start",
                "startTime",
                "timeStart",
                "from",
                "begin"
            ]
        );


    const end =
        firstValue(
            config,
            [
                "end",
                "endTime",
                "timeEnd",
                "to",
                "finish"
            ]
        );


    if (
        start &&
        end
    ) {

        return {

            start: start,

            end: end,

            text:
                `${start} — ${end}`

        };

    }


    /*
       Возможные названия
       звонков в настройках
    */

    const bells =
        settings.bells ||
        settings.calls ||
        settings.rings ||
        settings.lessonTimes;


    if (bells) {

        let bell = null;


        if (Array.isArray(bells)) {

            bell =
                bells[lesson - 1];

        }

        else {

            bell =
                bells[lesson] ||
                bells[String(lesson)];

        }


        if (bell) {

            if (
                typeof bell === "string"
            ) {

                return {

                    start: bell,
                    end: "",
                    text: bell

                };

            }


            if (
                typeof bell === "object"
            ) {

                const bellStart =
                    firstValue(
                        bell,
                        [
                            "start",
                            "from",
                            "begin"
                        ]
                    );


                const bellEnd =
                    firstValue(
                        bell,
                        [
                            "end",
                            "to",
                            "finish"
                        ]
                    );


                return {

                    start:
                        bellStart || "",

                    end:
                        bellEnd || "",

                    text:
                        bellStart && bellEnd
                            ? `${bellStart} — ${bellEnd}`
                            : bellStart || bellEnd || "Время не настроено"

                };

            }

        }

    }


    return {

        start: "",
        end: "",
        text: "Время не настроено"

    };
}


/* =========================================================
   АТТЕСТАЦИЯ
========================================================= */

function getAttestationInfo(dateString) {

    const date =
        parseDate(dateString);

    const month =
        date.getMonth();


    /*
       Сначала пытаемся получить
       информацию из настроек.
    */

    if (
        settings.semester1 &&
        settings.semester1.attestation1
    ) {

        const value =
            settings.semester1.attestation1;

        if (typeof value === "object") {

            const dateFrom =
                value.from ||
                value.start;

            const dateTo =
                value.to ||
                value.end;

            if (
                dateFrom &&
                dateTo &&
                dateString >= dateFrom &&
                dateString <= dateTo
            ) {

                return {

                    semester: 1,

                    attestation: 1

                };

            }

        }

    }


    if (
        settings.semester1 &&
        settings.semester1.attestation2
    ) {

        const value =
            settings.semester1.attestation2;

        if (typeof value === "object") {

            const dateFrom =
                value.from ||
                value.start;

            const dateTo =
                value.to ||
                value.end;

            if (
                dateFrom &&
                dateTo &&
                dateString >= dateFrom &&
                dateString <= dateTo
            ) {

                return {

                    semester: 1,

                    attestation: 2

                };

            }

        }

    }


    if (
        settings.semester2 &&
        settings.semester2.attestation1
    ) {

        const value =
            settings.semester2.attestation1;

        if (typeof value === "object") {

            const dateFrom =
                value.from ||
                value.start;

            const dateTo =
                value.to ||
                value.end;

            if (
                dateFrom &&
                dateTo &&
                dateString >= dateFrom &&
                dateString <= dateTo
            ) {

                return {

                    semester: 2,

                    attestation: 1

                };

            }

        }

    }


    if (
        settings.semester2 &&
        settings.semester2.attestation2
    ) {

        const value =
            settings.semester2.attestation2;

        if (typeof value === "object") {

            const dateFrom =
                value.from ||
                value.start;

            const dateTo =
                value.to ||
                value.end;

            if (
                dateFrom &&
                dateTo &&
                dateString >= dateFrom &&
                dateString <= dateTo
            ) {

                return {

                    semester: 2,

                    attestation: 2

                };

            }

        }

    }


    /*
       Запасной вариант:
       август и январь
    */

    const semester =
        (
            month === 8 ||
            month === 0
        )
            ? 1
            : 2;


    return {

        semester: semester,

        attestation: "—"

    };
}


/* =========================================================
   FIREBASE — НАСТРОЙКИ
========================================================= */

async function loadSettings() {

    const settingsRef =
        doc(
            db,
            "settings",
            "main"
        );


    const snapshot =
        await getDoc(settingsRef);


    if (snapshot.exists()) {

        settings =
            snapshot.data();

    }

    else {

        /*
           Запасное расписание
        */

        settings = {

            schedule: {

                "Понедельник": 5,
                "Вторник": 5,
                "Среда": 5,
                "Четверг": 5,
                "Пятница": 5,
                "Суббота": 5

            }

        };

    }

}


/* =========================================================
   FIREBASE — СТУДЕНТЫ
========================================================= */

async function loadStudents() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "students"
            )
        );


    students =
        snapshot.docs.map(
            item => ({

                id: item.id,

                ...item.data()

            })
        );


    students.sort(
        (a, b) => {

            const nameA =
                String(
                    a.name || ""
                );

            const nameB =
                String(
                    b.name || ""
                );


            return nameA.localeCompare(
                nameB,
                "ru"
            );

        }
    );

}


/* =========================================================
   FIREBASE — ПОСЕЩАЕМОСТЬ
========================================================= */

async function loadAttendance() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "attendance"
            )
        );


    attendance = {};


    snapshot.docs.forEach(
        item => {

            const data =
                item.data();


            const date =
                data.date || "";


            const studentId =
                data.studentId || "";


            if (
                date &&
                studentId
            ) {

                const key =
                    `${date}_${studentId}`;


                attendance[key] =
                    data;

            }

        }
    );

}


/* =========================================================
   ПОЛУЧИТЬ ДЕНЬ СТУДЕНТА
========================================================= */

function getStudentDay(studentId) {

    const key =
        `${selectedDate}_${studentId}`;


    return attendance[key] || {

        studentId: studentId,

        date: selectedDate,

        lessons: {}

    };
}


/* =========================================================
   ПОЛУЧИТЬ ОТМЕТКУ ПАРЫ
========================================================= */

function getLessonData(
    studentId,
    lesson
) {

    const day =
        getStudentDay(studentId);


    if (
        day.lessons &&
        day.lessons[lesson]
    ) {

        return day.lessons[lesson];

    }


    return {

        status: "",

        reason: ""

    };
}


/* =========================================================
   ID ДОКУМЕНТА ПОСЕЩАЕМОСТИ
========================================================= */

function getAttendanceDocumentId(
    studentId
) {

    return `${selectedDate}_${studentId}`;

}


/* =========================================================
   СОХРАНЕНИЕ ДНЯ
========================================================= */

async function saveStudentDay(
    student,
    lessons
) {

    const info =
        getAttestationInfo(
            selectedDate
        );


    const documentId =
        getAttendanceDocumentId(
            student.id
        );


    const attendanceRef =
        doc(
            db,
            "attendance",
            documentId
        );


    const data = {

        studentId:
            student.id,

        studentName:
            student.name || "",

        date:
            selectedDate,

        lessons:
            lessons,

        semester:
            info.semester,

        attestation:
            info.attestation,

        updatedAt:
            new Date().toISOString()

    };


    await setDoc(
        attendanceRef,
        data,
        {
            merge: false
        }
    );


    const key =
        `${selectedDate}_${student.id}`;


    attendance[key] =
        data;

}


/* =========================================================
   УДАЛЕНИЕ ОТМЕТКИ
========================================================= */

async function deleteAttendance() {

    if (
        !selectedStudent ||
        !selectedLesson
    ) {

        return;

    }


    closeChoice();


    try {

        const day =
            getStudentDay(
                selectedStudent.id
            );


        const lessons = {

            ...(day.lessons || {})

        };


        const lessonData =
            lessons[selectedLesson];


        if (!lessonData) {

            showToast(
                "Отметки нет",
                "error"
            );

            return;

        }


        delete lessons[
            selectedLesson
        ];


        await saveStudentDay(
            selectedStudent,
            lessons
        );


        await render();


        showToast(
            "Отметка удалена"
        );

    }

    catch (error) {

        console.error(
            "Ошибка удаления:",
            error
        );


        showToast(
            "Не удалось удалить отметку",
            "error"
        );

    }

}


window.deleteAttendance =
    deleteAttendance;


/* =========================================================
   БЫСТРЫЙ РЕЖИМ
========================================================= */

function enableQuickMode(mode) {

    quickMode =
        mode;


    const panel =
        document.getElementById(
            "quickPanel"
        );


    const label =
        document.getElementById(
            "quickModeLabel"
        );


    if (panel) {

        panel.classList.add(
            "active"
        );

    }


    if (label) {

        if (mode === "present") {

            label.textContent =
                "✓ Режим присутствия";

        }

        else {

            label.textContent =
                "Н Режим отсутствия";

        }

    }


    if (mode === "present") {

        showToast(
            "Режим присутствия включён"
        );

    }

    else {

        showToast(
            "Режим отсутствия включён"
        );

    }

}


window.enableQuickMode =
    enableQuickMode;


/* =========================================================
   ОТКЛЮЧИТЬ БЫСТРЫЙ РЕЖИМ
========================================================= */

function disableQuickMode() {

    quickMode = null;


    const panel =
        document.getElementById(
            "quickPanel"
        );


    const label =
        document.getElementById(
            "quickModeLabel"
        );


    if (panel) {

        panel.classList.remove(
            "active"
        );

    }


    if (label) {

        label.textContent =
            "Режим не выбран";

    }


    showToast(
        "Быстрый режим отключён"
    );

}


window.disableQuickMode =
    disableQuickMode;


/* =========================================================
   БЫСТРОЕ ПРИСУТСТВИЕ
========================================================= */

async function quickPresent(
    student,
    lesson
) {

    try {

        const day =
            getStudentDay(
                student.id
            );


        const lessons = {

            ...(day.lessons || {})

        };


        lessons[lesson] = {

            status:
                "present",

            reason:
                ""

        };


        await saveStudentDay(
            student,
            lessons
        );


        await render();


        showToast(
            `${student.name || "Студент"} — присутствует`
        );

    }

    catch (error) {

        console.error(
            "Ошибка сохранения:",
            error
        );


        showToast(
            "Ошибка сохранения",
            "error"
        );

    }

}


/* =========================================================
   БЫСТРОЕ ОТСУТСТВИЕ
========================================================= */

async function quickAbsent(
    student,
    lesson
) {

    selectedStudent =
        student;

    selectedLesson =
        lesson;


    selectedAction =
        "single";


    const data =
        getLessonData(
            student.id,
            lesson
        );


    document.getElementById(
        "modalStudent"
    ).textContent =
        student.name || "—";


    document.getElementById(
        "modalDate"
    ).textContent =
        formatDateRu(
            selectedDate
        );


    document.getElementById(
        "modalLesson"
    ).textContent =
        `${lesson} пара`;


    document.getElementById(
        "reasonInput"
    ).value =
        data.reason || "";


    setAbsenceTypeFromData(
        data
    );


    document.getElementById(
        "reasonOverlay"
    ).classList.add(
        "show"
    );

}


/* =========================================================
   ВЫБОР ТИПА ОТСУТСТВИЯ
========================================================= */

function selectAbsenceType(type) {

    selectedAbsenceType =
        type;


    const respectfulButton =
        document.getElementById(
            "respectfulButton"
        );


    const disrespectfulButton =
        document.getElementById(
            "disrespectfulButton"
        );


    if (respectfulButton) {

        respectfulButton.classList.toggle(
            "active",
            type === "respectful"
        );

    }


    if (disrespectfulButton) {

        disrespectfulButton.classList.toggle(
            "active",
            type === "disrespectful"
        );

    }

}


window.selectAbsenceType =
    selectAbsenceType;


/* =========================================================
   УСТАНОВИТЬ ТИП ИЗ ДАННЫХ
========================================================= */

function setAbsenceTypeFromData(data) {

    if (
        data &&
        data.absenceType ===
            "respectful"
    ) {

        selectAbsenceType(
            "respectful"
        );

    }

    else {

        selectAbsenceType(
            "disrespectful"
        );

    }

}


/* =========================================================
   RENDER
========================================================= */

async function render() {

    const dayIndex =
        getDayIndex(
            selectedDate
        );


    /*
       День недели
    */

    const dayName =
        document.getElementById(
            "dayName"
        );


    if (dayName) {

        dayName.textContent =
            getDayName(
                selectedDate
            );

    }


    /*
       Количество пар
    */

    const lessonCount =
        dayIndex >= 0
            ? getLessonCount(dayIndex)
            : 0;


    const lessonBadge =
        document.getElementById(
            "lessonCountBadge"
        );


    if (lessonBadge) {

        let text;


        if (
            lessonCount === 1
        ) {

            text =
                "1 пара";

        }

        else if (
            lessonCount >= 2 &&
            lessonCount <= 4
        ) {

            text =
                `${lessonCount} пары`;

        }

        else {

            text =
                `${lessonCount} пар`;

        }


        lessonBadge.textContent =
            text;

    }


    /*
       Учебный период
    */

    const periodInfo =
        document.getElementById(
            "periodInfo"
        );


    if (periodInfo) {

        const info =
            getAttestationInfo(
                selectedDate
            );


        if (
            info.attestation !== "—"
        ) {

            periodInfo.textContent =
                `${info.semester} семестр • ${info.attestation} аттестация`;

        }

        else {

            periodInfo.textContent =
                `${info.semester} семестр`;

        }

    }


    /*
       Воскресенье
    */

    if (dayIndex < 0) {

        tableContainer.className =
            "empty-state";


        tableContainer.innerHTML = `

            <div class="empty-icon">
                📅
            </div>

            <div class="empty-title">
                Воскресенье
            </div>

            <div class="empty-text">
                В этот день занятий нет
            </div>

        `;

        return;

    }


    /*
       Нет пар
    */

    if (lessonCount <= 0) {

        tableContainer.className =
            "empty-state";


        tableContainer.innerHTML = `

            <div class="empty-icon">
                📚
            </div>

            <div class="empty-title">
                Пар нет
            </div>

            <div class="empty-text">
                На выбранную дату пары не настроены
            </div>

        `;

        return;

    }


    /*
       Нет студентов
    */

    if (!students.length) {

        tableContainer.className =
            "empty-state";


        tableContainer.innerHTML = `

            <div class="empty-icon">
                👥
            </div>

            <div class="empty-title">
                Студенты не найдены
            </div>

            <div class="empty-text">
                В базе данных пока нет студентов
            </div>

        `;

        return;

    }


    /*
       Таблица
    */

    tableContainer.className =
        "";


    let html = `

        <table class="attendance-table">

            <thead>

                <tr>

                    <th class="student-column">
                        Студент
                    </th>

    `;


    /*
       Заголовки пар
    */

    for (
        let lesson = 1;
        lesson <= lessonCount;
        lesson++
    ) {

        const discipline =
            getDiscipline(
                dayIndex,
                lesson
            );


        const time =
            getLessonTime(
                dayIndex,
                lesson
            );


        html += `

            <th
                class="lesson-column"
                onclick="window.openLessonInfo(${lesson})">

                <div class="lesson-number">
                    ${lesson} пара
                </div>

                <div class="lesson-discipline">
                    ${escapeHtml(
                        discipline
                    )}
                </div>

                <div class="lesson-time">
                    ${escapeHtml(
                        time.text
                    )}
                </div>

            </th>

        `;

    }


    html += `

                </tr>

            </thead>

            <tbody>

    `;


    /*
       Студенты
    */

    students.forEach(
        student => {

            html += `

                <tr>

                    <td class="student-name">

                        <div class="student-name-main">
                            ${escapeHtml(
                                student.name ||
                                "Без имени"
                            )}
                        </div>

                    </td>

            `;


            for (
                let lesson = 1;
                lesson <= lessonCount;
                lesson++
            ) {

                const data =
                    getLessonData(
                        student.id,
                        lesson
                    );


                let className =
                    "status-empty";


                let symbol =
                    "—";


                if (
                    data.status ===
                    "present"
                ) {

                    className =
                        "status-present";

                    symbol =
                        "✓";

                }

                else if (
                    data.status ===
                    "absent"
                ) {

                    if (
                        data.absenceType ===
                        "respectful"
                    ) {

                        className =
                            "status-respectful";

                        symbol =
                            "У";

                    }

                    else {

                        className =
                            "status-disrespectful";

                        symbol =
                            "Н";

                    }

                }


                html += `

                    <td
                        class="attendance-cell ${className}"
                        onclick="window.openCell('${escapeJs(student.id)}', ${lesson})">

                        <span class="attendance-status">
                            ${symbol}
                        </span>

                    </td>

                `;

            }


            html += `

                </tr>

            `;

        }
    );


    html += `

            </tbody>

        </table>

    `;


    tableContainer.innerHTML =
        html;

}


/* =========================================================
   ОТКРЫТИЕ ЯЧЕЙКИ
========================================================= */

window.openCell =
    async function(
        studentId,
        lesson
    ) {

        const student =
            students.find(
                item =>
                    String(item.id) ===
                    String(studentId)
            );


        if (!student) {

            showToast(
                "Студент не найден",
                "error"
            );

            return;

        }


        /*
           Быстрое присутствие
        */

        if (
            quickMode ===
            "present"
        ) {

            await quickPresent(
                student,
                lesson
            );

            return;

        }


        /*
           Быстрое отсутствие
        */

        if (
            quickMode ===
            "absent"
        ) {

            await quickAbsent(
                student,
                lesson
            );

            return;

        }


        selectedStudent =
            student;

        selectedLesson =
            lesson;


        const data =
            getLessonData(
                student.id,
                lesson
            );


        document.getElementById(
            "choiceStudent"
        ).textContent =
            student.name || "—";


        /*
           Показываем кнопку удаления,
           если отметка существует.
        */

        const deleteButton =
            document.getElementById(
                "deleteButton"
            );


        if (deleteButton) {

            deleteButton.style.display =
                data.status
                    ? "flex"
                    : "none";

        }


        document.getElementById(
            "choiceOverlay"
        ).classList.add(
            "show"
        );

    };


/* =========================================================
   ЗАКРЫТЬ МЕНЮ
========================================================= */

function closeChoice() {

    const overlay =
        document.getElementById(
            "choiceOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );

    }


    selectedStudent =
        null;

    selectedLesson =
        null;

}


window.closeChoice =
    closeChoice;


/* =========================================================
   ЗАКРЫТИЕ ПО ФОНУ
========================================================= */

function closeChoiceOutside(event) {

    if (
        event.target &&
        event.target.id ===
            "choiceOverlay"
    ) {

        closeChoice();

    }

}


window.closeChoiceOutside =
    closeChoiceOutside;


/* =========================================================
   ПРИСУТСТВИЕ
========================================================= */

async function choosePresent() {

    if (
        !selectedStudent ||
        !selectedLesson
    ) {

        return;

    }


    try {

        const day =
            getStudentDay(
                selectedStudent.id
            );


        const lessons = {

            ...(day.lessons || {})

        };


        lessons[selectedLesson] = {

            status:
                "present",

            reason:
                ""

        };


        await saveStudentDay(
            selectedStudent,
            lessons
        );


        closeChoice();


        await render();


        showToast(
            "Присутствие сохранено"
        );

    }

    catch (error) {

        console.error(
            "Ошибка:",
            error
        );


        showToast(
            "Ошибка сохранения",
            "error"
        );

    }

}


window.choosePresent =
    choosePresent;


/* =========================================================
   ОТСУТСТВИЕ
========================================================= */

function chooseAbsent() {

    if (
        !selectedStudent ||
        !selectedLesson
    ) {

        return;

    }


    const data =
        getLessonData(
            selectedStudent.id,
            selectedLesson
        );


    document.getElementById(
        "modalStudent"
    ).textContent =
        selectedStudent.name || "—";


    document.getElementById(
        "modalDate"
    ).textContent =
        formatDateRu(
            selectedDate
        );


    document.getElementById(
        "modalLesson"
    ).textContent =
        `${selectedLesson} пара`;


    document.getElementById(
        "reasonInput"
    ).value =
        data.reason || "";


    setAbsenceTypeFromData(
        data
    );


    selectedAction =
        "single";


    closeChoice();


    document.getElementById(
        "reasonOverlay"
    ).classList.add(
        "show"
    );

}


window.chooseAbsent =
    chooseAbsent;


/* =========================================================
   ВЕСЬ ДЕНЬ
========================================================= */

function chooseWholeDay() {

    if (
        !selectedStudent
    ) {

        return;

    }


    document.getElementById(
        "modalStudent"
    ).textContent =
        selectedStudent.name || "—";


    document.getElementById(
        "modalDate"
    ).textContent =
        formatDateRu(
            selectedDate
        );


    document.getElementById(
        "modalLesson"
    ).textContent =
        "Все пары";


    document.getElementById(
        "reasonInput"
    ).value =
        "";


    selectAbsenceType(
        "disrespectful"
    );


    selectedAction =
        "wholeDay";


    closeChoice();


    document.getElementById(
        "reasonOverlay"
    ).classList.add(
        "show"
    );

}


window.chooseWholeDay =
    chooseWholeDay;


/* =========================================================
   СОХРАНИТЬ ОТСУТСТВИЕ
========================================================= */

async function saveAbsent() {

    if (
        !selectedStudent
    ) {

        return;

    }


    const reasonInput =
        document.getElementById(
            "reasonInput"
        );


    const reason =
        reasonInput
            ? reasonInput.value.trim()
            : "";


    try {

        const day =
            getStudentDay(
                selectedStudent.id
            );


        const lessons = {

            ...(day.lessons || {})

        };


        /*
           Только одна пара
        */

        if (
            selectedAction ===
            "single"
        ) {

            lessons[
                selectedLesson
            ] = {

                status:
                    "absent",

                absenceType:
                    selectedAbsenceType,

                reason:
                    reason

            };

        }


        /*
           Весь день
        */

        else if (
            selectedAction ===
            "wholeDay"
        ) {

            const dayIndex =
                getDayIndex(
                    selectedDate
                );


            const lessonCount =
                dayIndex >= 0
                    ? getLessonCount(
                        dayIndex
                    )
                    : 0;


            for (
                let lesson = 1;
                lesson <= lessonCount;
                lesson++
            ) {

                lessons[lesson] = {

                    status:
                        "absent",

                    absenceType:
                        selectedAbsenceType,

                    reason:
                        reason

                };

            }

        }


        await saveStudentDay(
            selectedStudent,
            lessons
        );


        closeReason();


        await render();


        if (
            selectedAction ===
            "wholeDay"
        ) {

            showToast(
                selectedAbsenceType ===
                "respectful"
                    ? "Весь день отмечен как У"
                    : "Весь день отмечен как Н"
            );

        }

        else {

            showToast(
                selectedAbsenceType ===
                "respectful"
                    ? "Отмечено: уважительно"
                    : "Отмечено: неуважительно"
            );

        }

    }

    catch (error) {

        console.error(
            "Ошибка сохранения отсутствия:",
            error
        );


        showToast(
            "Ошибка сохранения",
            "error"
        );

    }

}


window.saveAbsent =
    saveAbsent;


/* =========================================================
   ЗАКРЫТЬ ПРИЧИНУ
========================================================= */

function closeReason() {

    const overlay =
        document.getElementById(
            "reasonOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );

    }


    selectedAction =
        null;

}


window.closeReason =
    closeReason;


/* =========================================================
   ИНФОРМАЦИЯ О ПАРЕ
========================================================= */

function openLessonInfo(lesson) {

    const dayIndex =
        getDayIndex(
            selectedDate
        );


    if (dayIndex < 0) {

        return;

    }


    const discipline =
        getDiscipline(
            dayIndex,
            lesson
        );


    const time =
        getLessonTime(
            dayIndex,
            lesson
        );


    document.getElementById(
        "lessonInfoTitle"
    ).textContent =
        `${lesson} пара`;


    document.getElementById(
        "lessonInfoSubtitle"
    ).textContent =
        getDayName(
            selectedDate
        );


    document.getElementById(
        "lessonDiscipline"
    ).textContent =
        discipline;


    document.getElementById(
        "lessonTime"
    ).textContent =
        time.text;


    document.getElementById(
        "lessonStart"
    ).textContent =
        time.start || "—";


    document.getElementById(
        "lessonEnd"
    ).textContent =
        time.end || "—";


    document.getElementById(
        "lessonInfoOverlay"
    ).classList.add(
        "show"
    );

}


window.openLessonInfo =
    openLessonInfo;


/* =========================================================
   ЗАКРЫТЬ ИНФОРМАЦИЮ О ПАРЕ
========================================================= */

function closeLessonInfo() {

    const overlay =
        document.getElementById(
            "lessonInfoOverlay"
        );


    if (overlay) {

        overlay.classList.remove(
            "show"
        );

    }

}


window.closeLessonInfo =
    closeLessonInfo;


/* =========================================================
   ESC
========================================================= */

document.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        closeChoice();

        closeReason();

        closeLessonInfo();

    }
);


/* =========================================================
   DATE CHANGE
========================================================= */

datePicker.addEventListener(
    "change",
    async function() {

        selectedDate =
            this.value;


        await reloadData();

    }
);


/* =========================================================
   RELOAD DATA
========================================================= */

async function reloadData() {

    tableContainer.className =
        "loading";


    tableContainer.innerHTML = `

        <div class="spinner"></div>

        Загрузка данных...

    `;


    try {

        await loadSettings();

        await loadStudents();

        await loadAttendance();

        await render();

    }

    catch (error) {

        console.error(
            "Ошибка загрузки:",
            error
        );


        tableContainer.className =
            "empty-state";


        tableContainer.innerHTML = `

            <div class="empty-icon">
                ⚠️
            </div>

            <div class="empty-title">
                Ошибка загрузки
            </div>

            <div class="empty-text">
                Не удалось загрузить данные
                из Firebase
            </div>

        `;


        showToast(
            "Ошибка подключения к Firebase",
            "error"
        );


        throw error;

    }

}


window.reloadData =
    reloadData;


/* =========================================================
   ЧАСЫ
========================================================= */

function updateClock() {

    const now =
        new Date();


    const clock =
        document.getElementById(
            "clock"
        );


    const clockDate =
        document.getElementById(
            "clockDate"
        );


    if (clock) {

        clock.textContent =
            now.toLocaleTimeString(
                "ru-RU"
            );

    }


    if (clockDate) {

        let text =
            now.toLocaleDateString(
                "ru-RU",
                {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                }
            );


        text =
            text.charAt(0).toUpperCase() +
            text.slice(1);


        clockDate.textContent =
            text;

    }

}


/* =========================================================
   TOAST
========================================================= */

let toastTimer;


function showToast(
    message,
    type = ""
) {

    const toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {
        return;
    }


    toast.textContent =
        message;


    toast.className =
        `toast show ${type}`;


    clearTimeout(
        toastTimer
    );


    toastTimer =
        setTimeout(
            () => {

                toast.className =
                    "toast";

            },
            2500
        );

}


/* =========================================================
   ЭКРАНИРОВАНИЕ HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   ЭКРАНИРОВАНИЕ JAVASCRIPT
========================================================= */

function escapeJs(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );

}


/* =========================================================
   НАЗАД
========================================================= */

function goBack() {

    window.location.replace(
        "index.html"
    );

}


window.goBack =
    goBack;


/* =========================================================
   КЛИК ПО ФОНУ ПРИЧИНЫ
========================================================= */

document.getElementById(
    "reasonOverlay"
)?.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            this
        ) {

            closeReason();

        }

    }
);


/* =========================================================
   КЛИК ПО ФОНУ ИНФОРМАЦИИ О ПАРЕ
========================================================= */

document.getElementById(
    "lessonInfoOverlay"
)?.addEventListener(
    "click",
    function(event) {

        if (
            event.target ===
            this
        ) {

            closeLessonInfo();

        }

    }
);


/* =========================================================
   ЗАПУСК
========================================================= */

async function start() {

    /*
       Сегодняшняя дата
    */

    selectedDate =
        formatDate(
            new Date()
        );


    /*
       Устанавливаем
       дату в календарь
    */

    if (datePicker) {

        datePicker.value =
            selectedDate;

    }


    /*
       Часы
    */

    updateClock();


    setInterval(
        updateClock,
        1000
    );


    /*
       Загружаем Firebase
    */

    try {

        await reloadData();

    }

    catch (error) {

        console.error(
            "Ошибка запуска:",
            error
        );

    }


    /*
       Скрываем загрузчик
    */

    setTimeout(
        () => {

            const loader =
                document.getElementById(
                    "pageLoader"
                );


            if (loader) {

                loader.classList.add(
                    "hidden"
                );

            }

        },
        400
    );

}


/* =========================================================
   START
========================================================= */

start();