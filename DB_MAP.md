# 🗺️ STRUCTURE DE LA BASE DE DONNÉES
Généré le : 2/15/2026, 10:34:41 AM

## 📦 Collection : `academicyears` (Model: AcademicYear)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **isCurrent** | `Boolean` | Def: true |
| **label** | `String` | ✅ REQ |

---

## 📦 Collection : `accesslogs` (Model: AccessLog)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **action** | `String` | - |
| **timestamp** | `Date` | Def: (func) |
| **userId** | `String` | - |

---

## 📦 Collection : `admins` (Model: Admin)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **email** | `String` | ✅ REQ, 🔑 UNIQUE |
| **firstName** | `String` | ✅ REQ |
| **isDeveloper** | `Boolean` | Def: false |
| **isTestAccount** | `Boolean` | Def: false |
| **lastName** | `String` | ✅ REQ |
| **password** | `String` | ✅ REQ |
| **role** | `String` | Def: admin, Enum: [admin, developer] |
| **subjectSections** | `[Mixed/Object]` | Def:  |

---

## 📦 Collection : `bugreports` (Model: BugReport)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **createdAt** | `Date` | Def: (func) |
| **description** | `String` | - |
| **stack** | `String` | - |
| **status** | `String` | Def: open |

---

## 📦 Collection : `classrooms` (Model: Classroom)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **associatedClasses** | `[🔗 Ref(Classroom)]` | - |
| **layout** | `Embedded` | Def: (func) |
| **level** | `String` | - |
| **name** | `String` | ✅ REQ, 🔑 UNIQUE |
| **type** | `String` | Def: CLASS, Enum: [CLASS, GROUP] |
| **yearId** | `ObjectId` | - |

---

## 📦 Collection : `deploysignals` (Model: DeploySignal)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **status** | `String` | - |
| **updatedAt** | `Date` | - |

---

## 📦 Collection : `enrollments` (Model: Enrollment)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **classId** | `ObjectId` | ✅ REQ |
| **studentId** | `ObjectId` | ✅ REQ |
| **yearId** | `ObjectId` | ✅ REQ |

---

## 📦 Collection : `projectdocs` (Model: ProjectDoc)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **description** | `String` | - |
| **fileName** | `String` | 🔑 UNIQUE |

---

## 📦 Collection : `students` (Model: Student)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **activePunishmentId** | `ObjectId` | - |
| **assignedGroups** | `[🔗 Ref(Classroom)]` | - |
| **behaviorRecords** | `[Mixed/Object]` | Def:  |
| **birthDate** | `String` | Def:  |
| **classId** | `ObjectId` | - |
| **currentClass** | `String` | - |
| **currentLevel** | `String` | - |
| **email** | `String` | - |
| **firstName** | `String` | ✅ REQ |
| **fullName** | `String` | - |
| **gender** | `String` | Def: M, Enum: [M, F] |
| **hasReward** | `Boolean` | Def: false |
| **isTestAccount** | `Boolean` | Def: false |
| **lastLogin** | `Date` | Def: (func) |
| **lastName** | `String` | ✅ REQ |
| **parentEmail** | `String` | - |
| **password** | `String` | Def: 123456 |
| **punishmentDueDate** | `Date` | - |
| **punishmentStatus** | `String` | Def: NONE, Enum: [NONE, PENDING, LATE, DONE] |
| **seatX** | `Number` | Def: 0 |
| **seatY** | `Number` | Def: 0 |
| **teacherNotes** | `[Mixed/Object]` | Def:  |

---

## 📦 Collection : `subjects` (Model: Subject)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **color** | `String` | Def: #6366f1 |
| **icon** | `String` | - |
| **name** | `String` | ✅ REQ, 🔑 UNIQUE |

---

## 📦 Collection : `teachers` (Model: Teacher)
| Champ | Type | Options |
| :--- | :--- | :--- |
| **_id** | `ObjectId` | - |
| **assignedClasses** | `[🔗 Ref(Classroom)]` | - |
| **assignedClassesText** | `String` | Def:  |
| **driveFolderId** | `String` | - |
| **firstName** | `String` | ✅ REQ |
| **isDeveloper** | `Boolean` | Def: false |
| **isTestAccount** | `Boolean` | Def: false |
| **lastName** | `String` | ✅ REQ |
| **password** | `String` | ✅ REQ |
| **subjectSections** | `[Mixed/Object]` | Def:  |
| **taughtSubjects** | `[🔗 Ref(Subject)]` | - |
| **taughtSubjectsText** | `String` | Def:  |

---