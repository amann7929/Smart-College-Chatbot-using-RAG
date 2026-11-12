"""Content of the demonstration documents.

EVERYTHING HERE IS FICTIONAL. "Sample Institute of Engineering" (SIE) does not exist. Names, numbers, dates,
phone numbers and e-mail addresses are invented for demonstrating the chatbot. Replace these PDFs with official
documents for real use (see knowledge_base/README.md).

Each document: category (must match app.rag.categories), slug (file name), title, sections.
A section is (heading, items); an item is a paragraph (str) or a bullet list (list[str]).
"""

INTRO = ("Sample Institute of Engineering (SIE) is a FICTIONAL institution created only to demonstrate the College "
         "Chatbot. All facts, figures, dates and names in this document are invented sample data and must not be "
         "treated as real information.")

DOCS: list[dict] = [
    {
        "category": "College Profile", "slug": "College_Profile", "title": "College Profile - Sample Institute of Engineering",
        "sections": [
            ("About the Institute", [INTRO,
                "SIE was established in 1998 in the fictional town of Sampleville, Exampleland. It is a private engineering "
                "college affiliated to the fictional Example State Technical University (ESTU). The institute offers "
                "undergraduate, postgraduate and doctoral programmes in engineering and technology.",
                "The campus covers 40 acres and has about 3,200 students and 180 faculty members."]),
            ("Vision", ["To be a centre of excellence in engineering education that produces ethical, innovative and "
                        "employable technologists."]),
            ("Mission", ["Provide industry-relevant curriculum with strong fundamentals.",
                         "Encourage research, innovation and entrepreneurship among students.",
                         "Build a supportive campus community with high standards of integrity."]),
            ("Campus at a Glance", [[
                "Academic blocks: Block A (CSE and CSE-AI), Block B (ECE), Block C (Mechanical and Civil), Block D (Administration).",
                "Central library, sports complex, auditorium with 800 seats, health centre and two canteens.",
                "Separate hostels for boys and girls, and a college bus service covering the city.",
                "Campus-wide Wi-Fi and a 24x7 computing lab for final-year project work."]]),
            ("Governance", ["The institute is run by the Sample Education Trust. The Principal is the academic head. "
                "Principal: Dr. Meera Sample (fictional). Dean of Academics: Prof. Arjun Demo (fictional). "
                "Registrar: Mr. Kabir Example (fictional)."]),
            ("Recognition", ["For this sample document, accreditation and ranking details are not provided. A real "
                "institution should add its approvals, accreditations and rankings here."]),
        ],
    },
    {
        "category": "Courses and Departments", "slug": "Courses_and_Departments", "title": "Courses and Departments",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Undergraduate Programmes (B.Tech, 4 years, 8 semesters)", [[
                "B.Tech Computer Science and Engineering (CSE): 120 seats.",
                "B.Tech Computer Science and Engineering with specialisation in Artificial Intelligence (CSE-AI): 60 seats.",
                "B.Tech Electronics and Communication Engineering (ECE): 60 seats.",
                "B.Tech Mechanical Engineering (ME): 60 seats.",
                "B.Tech Civil Engineering (CE): 60 seats."]]),
            ("Postgraduate and Doctoral Programmes", [[
                "M.Tech in Computer Science and Engineering: 2 years, 18 seats.",
                "M.Tech in VLSI Design: 2 years, 18 seats.",
                "Ph.D. programmes are offered in CSE, ECE and Mechanical Engineering, subject to research committee approval."]]),
            ("Department of Computer Science and Engineering", ["Head of Department: Dr. Priya Sample (fictional). "
                "The department runs the CSE and CSE-AI programmes and the Artificial Intelligence Lab, Data Science Lab "
                "and Networks Lab. Research areas include machine learning, natural language processing and cloud computing."]),
            ("Department of Electronics and Communication Engineering", ["Head of Department: Dr. Ravi Demo (fictional). "
                "Laboratories: VLSI Lab, Embedded Systems Lab, Communication Lab. Research areas include signal processing and IoT."]),
            ("Departments of Mechanical and Civil Engineering", ["Mechanical head: Dr. Sunil Example (fictional). Civil head: "
                "Dr. Anita Sample (fictional). Facilities include a CAD/CAM lab, thermal engineering lab, structural "
                "engineering lab and surveying equipment."]),
            ("Department of Basic Sciences and Humanities", ["Teaches first-year physics, chemistry, mathematics, "
                "communication skills and environmental studies to all branches."]),
        ],
    },
    {
        "category": "Admission Process", "slug": "Admission_Process", "title": "Admission Process 2026-27",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Eligibility for B.Tech", [[
                "Passed class 12 (or equivalent) with Physics and Mathematics and one of Chemistry, Computer Science or Electronics.",
                "Minimum 50 percent aggregate marks in these subjects (45 percent for reserved categories).",
                "A valid score in the SIE Common Entrance Test (SIE-CET), a fictional entrance exam, or an equivalent state-level exam."]]),
            ("Important Dates for 2026-27 Admissions", [[
                "Online application opens: 1 March 2026.",
                "Last date to apply: 30 June 2026.",
                "SIE-CET sample examination: 20 May 2026.",
                "Merit list published: 5 July 2026.",
                "Counselling and seat allotment: 10 July to 25 July 2026.",
                "Fee payment and admission confirmation: by 31 July 2026.",
                "Classes begin: 3 August 2026."]]),
            ("How to Apply", [[
                "Step 1: Register on the (fictional) SIE admission portal with a valid e-mail address and mobile number.",
                "Step 2: Fill in the application form and upload the required documents.",
                "Step 3: Pay the application fee of Rs. 1,000 online (Rs. 500 for reserved categories).",
                "Step 4: Appear for the entrance test or submit your equivalent exam score.",
                "Step 5: Attend counselling, choose a branch according to your rank and confirm the seat by paying the first instalment of fees."]]),
            ("Documents Required", [[
                "Class 10 and class 12 mark sheets and certificates.",
                "Entrance exam score card.",
                "Transfer certificate and migration certificate.",
                "Passport-size photographs (6 copies) and a valid photo ID.",
                "Category or income certificate, if applicable."]]),
            ("Lateral Entry and M.Tech Admission", ["Diploma holders may join the second year of B.Tech through lateral entry "
                "(limited seats, merit based). M.Tech admission requires a relevant B.Tech degree with 55 percent marks and "
                "a valid graduate aptitude test score."]),
            ("Admission Helpdesk", ["Write to admissions@sie.example or call the admission office (see Contact Information)."]),
        ],
    },
    {
        "category": "Fee Structure", "slug": "Fee_Structure", "title": "Fee Structure 2026-27 (B.Tech)",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Annual Tuition Fee", [[
                "CSE, CSE-AI and ECE: Rs. 95,000 per year.",
                "Mechanical and Civil Engineering: Rs. 85,000 per year.",
                "M.Tech (all specialisations): Rs. 70,000 per year."]]),
            ("Other Annual Charges", [[
                "Development fee: Rs. 10,000 per year.",
                "Examination fee: Rs. 2,500 per semester.",
                "Library caution deposit: Rs. 3,000, charged once and refundable at the end of the course.",
                "Student activity and sports fee: Rs. 2,000 per year.",
                "Application fee (non-refundable): Rs. 1,000."]]),
            ("Hostel and Transport", ["Hostel and bus charges are separate from tuition. Hostel fee is Rs. 60,000 per year "
                "including mess, plus a refundable caution deposit of Rs. 5,000. Bus fee depends on the zone and ranges from "
                "Rs. 15,000 to Rs. 22,000 per year. See the Hostel Facilities and Transport Facilities documents."]),
            ("Payment Schedule", [[
                "First instalment (60 percent of tuition and development fee): due by 15 July 2026.",
                "Second instalment (40 percent): due by 15 January 2027.",
                "Examination fee is paid before each semester examination form submission."]]),
            ("Late Payment", ["A late fine of Rs. 100 per day applies after the due date, up to a maximum of Rs. 2,000. "
                "Students who do not pay dues within 30 days of the due date may not be allowed to attend classes or exams."]),
            ("Refund Policy", [[
                "Withdrawal on or before 31 July 2026: 90 percent of tuition fee refunded.",
                "Withdrawal from 1 August to 31 August 2026: 50 percent of tuition fee refunded.",
                "Withdrawal after 31 August 2026: no refund of tuition fee.",
                "Application fee and examination fee are never refunded. Caution deposits are refunded after clearance."]]),
            ("Payment Modes", ["Fees can be paid by online banking, UPI or demand draft payable to Sample Education Trust. "
                "Cash payment is not accepted. Keep the receipt for all payments."]),
        ],
    },
    {
        "category": "Faculty Information", "slug": "Faculty_Information", "title": "Faculty Information",
        "sections": [
            ("Sample Data Notice", [INTRO + " All faculty names are fictional."]),
            ("Faculty Strength", ["SIE has 180 faculty members: 28 professors, 52 associate professors and 100 assistant "
                "professors. About 70 percent hold a Ph.D."]),
            ("Computer Science and Engineering", [[
                "Dr. Priya Sample, Professor and Head of Department. Research: machine learning, natural language processing.",
                "Prof. Rahul Demo, Associate Professor. Subjects: Database Systems, Data Mining.",
                "Dr. Sana Example, Associate Professor. Subjects: Artificial Intelligence, Deep Learning.",
                "Mr. Vikram Sample, Assistant Professor. Subjects: Operating Systems, Computer Networks."]]),
            ("Electronics and Communication Engineering", [[
                "Dr. Ravi Demo, Professor and Head of Department. Research: signal processing, IoT.",
                "Dr. Neha Example, Associate Professor. Subjects: VLSI Design, Digital Electronics.",
                "Mr. Arun Sample, Assistant Professor. Subjects: Embedded Systems, Microcontrollers."]]),
            ("Mechanical and Civil Engineering", [[
                "Dr. Sunil Example, Professor and Head of Mechanical Engineering. Research: thermal systems.",
                "Dr. Anita Sample, Professor and Head of Civil Engineering. Research: structural analysis.",
                "Mr. Deepak Demo, Assistant Professor. Subjects: Engineering Mechanics, Surveying."]]),
            ("Contacting Faculty", ["Faculty e-mail addresses follow the pattern firstname.lastname@sie.example. "
                "Students should meet faculty during office hours: Monday to Friday, 3:00 pm to 4:30 pm, or by prior "
                "appointment. Department offices are listed in the Contact Information document."]),
            ("Faculty Advisors", ["Every first-year section has a faculty advisor who guides students on academics, "
                "attendance and personal concerns. Advisors are announced in the first week of the semester."]),
        ],
    },
    {
        "category": "Syllabus", "slug": "Syllabus_CSE_AI", "title": "Syllabus Overview - B.Tech CSE (Artificial Intelligence)",
        "sections": [
            ("Sample Data Notice", [INTRO + " Course codes and contents are invented."]),
            ("Credit Structure", ["The B.Tech programme has 160 credits over 8 semesters. A typical semester carries 20 to 22 credits. "
                "One theory credit equals one lecture hour per week. One lab credit equals two lab hours per week."]),
            ("Semester 1 (common to all branches)", [[
                "SAM-101 Engineering Mathematics I - 4 credits. Calculus, matrices, differential equations.",
                "SAM-102 Engineering Physics - 3 credits. Waves, optics, quantum basics, semiconductors.",
                "SAM-103 Programming in Python - 4 credits. Variables, control flow, functions, files, introduction to NumPy.",
                "SAM-104 Communication Skills - 2 credits. Technical writing, presentations, group discussion.",
                "SAM-105 Engineering Graphics - 3 credits. Projections, sections, CAD basics.",
                "SAM-106 Programming Lab - 2 credits. Weekly Python laboratory exercises."]]),
            ("Semester 3 (CSE-AI)", [[
                "SAM-301 Data Structures - 4 credits. Arrays, linked lists, stacks, queues, trees, graphs, hashing, sorting.",
                "SAM-302 Discrete Mathematics - 3 credits. Logic, sets, relations, graph theory, combinatorics.",
                "SAM-303 Probability and Statistics for AI - 3 credits. Random variables, distributions, estimation, hypothesis testing.",
                "SAM-304 Digital Logic and Computer Organisation - 4 credits. Boolean algebra, combinational and sequential circuits.",
                "SAM-305 Data Structures Lab - 2 credits."]]),
            ("Semester 5 (CSE-AI)", [[
                "SAM-501 Machine Learning - 4 credits. Regression, classification, decision trees, SVM, clustering, evaluation metrics.",
                "SAM-502 Database Management Systems - 3 credits. ER model, SQL, normalisation, transactions, indexing.",
                "SAM-503 Natural Language Processing - 3 credits. Text preprocessing, embeddings, transformers, retrieval-augmented generation.",
                "SAM-504 Computer Networks - 3 credits. OSI and TCP/IP models, routing, transport layer, application protocols.",
                "SAM-505 Machine Learning Lab - 2 credits. Projects using scikit-learn and vector databases."]]),
            ("Semester 7 and 8", ["Semester 7 includes Deep Learning, a professional elective and a minor project. "
                "Semester 8 consists of a six-month industry internship or a major project worth 12 credits, plus a seminar."]),
            ("Assessment Pattern", ["Each theory course has 40 marks for internal assessment (two mid-semester tests, "
                "assignments and quizzes) and 60 marks for the end-semester examination. Lab courses are assessed on "
                "continuous evaluation and a viva voce."]),
        ],
    },
    {
        "category": "Examination Rules", "slug": "Examination_Rules", "title": "Examination Rules and Regulations",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Eligibility to Appear", [[
                "A student needs at least 75 percent attendance in each course to be eligible for the end-semester examination.",
                "Attendance between 65 and 75 percent may be condoned by the Dean on medical or other valid grounds, with a condonation fee of Rs. 500 per course.",
                "Students below 65 percent attendance must repeat the course."]]),
            ("Marks and Passing Criteria", [[
                "Each theory course is evaluated out of 100: 40 internal marks and 60 end-semester marks.",
                "To pass, a student must score at least 40 percent overall and at least 35 percent in the end-semester examination.",
                "Failed courses can be cleared in the supplementary examination held after the semester results."]]),
            ("Grading Scale", [[
                "O (Outstanding): 90 to 100 marks, 10 grade points.",
                "A+: 80 to 89 marks, 9 grade points.",
                "A: 70 to 79 marks, 8 grade points.",
                "B+: 60 to 69 marks, 7 grade points.",
                "B: 50 to 59 marks, 6 grade points.",
                "C: 40 to 49 marks, 5 grade points.",
                "F (Fail): below 40 marks, 0 grade points."]]),
            ("Conduct in the Examination Hall", [[
                "Carry the college ID card and hall ticket. Entry is not allowed after 30 minutes from the start of the exam.",
                "Mobile phones, smart watches and any electronic devices are strictly prohibited in the examination hall.",
                "Only approved scientific calculators may be used when the question paper permits.",
                "Students must not leave the hall during the first 45 minutes."]]),
            ("Malpractice", ["Copying, impersonation or possession of unauthorised material is treated as malpractice. "
                "Penalties range from cancellation of the paper to cancellation of the whole semester and, in serious cases, "
                "expulsion. Decisions are taken by the Examination Malpractice Committee."]),
            ("Re-evaluation and Revaluation", ["Students may apply for re-evaluation within 7 days of the result announcement by "
                "paying Rs. 500 per paper. Revised marks are announced within 15 days."]),
            ("Results", ["End-semester results are normally published within 30 days of the last examination on the student portal."]),
        ],
    },
    {
        "category": "Academic Calendar", "slug": "Academic_Calendar_2026_27", "title": "Academic Calendar 2026-27",
        "sections": [
            ("Sample Data Notice", [INTRO + " Dates are invented."]),
            ("Odd Semester (Semesters 1, 3, 5, 7)", [[
                "Classes begin: 3 August 2026.",
                "First mid-semester tests: 5 October to 10 October 2026.",
                "Autumn festival break: 9 November to 13 November 2026.",
                "Last day of classes: 20 November 2026.",
                "End-semester examinations: 1 December to 19 December 2026.",
                "Winter vacation: 21 December 2026 to 8 January 2027."]]),
            ("Even Semester (Semesters 2, 4, 6, 8)", [[
                "Classes begin: 11 January 2027.",
                "Second mid-semester tests: 8 March to 13 March 2027.",
                "Annual cultural and technical fest (SIE Fest): 26 February to 28 February 2027.",
                "Last day of classes: 23 April 2027.",
                "End-semester examinations: 3 May to 21 May 2027.",
                "Summer vacation and internships: 24 May to 31 July 2027."]]),
            ("Other Important Dates", [[
                "Orientation programme for first-year students: 27 July to 1 August 2026.",
                "Last date for course registration: 14 August 2026.",
                "Scholarship application deadline: 31 August 2026.",
                "Placement season begins: 1 September 2026.",
                "Supplementary examinations: 7 June to 18 June 2027.",
                "Convocation: 20 June 2027."]]),
            ("Holidays", ["The institute is closed on national holidays and on Sundays. Any change in the calendar is "
                "announced by the Dean of Academics through the student portal and notice boards."]),
        ],
    },
    {
        "category": "Hostel Facilities", "slug": "Hostel_Facilities", "title": "Hostel Facilities and Rules",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Accommodation", [[
                "Boys hostel: 3 blocks, capacity 600 students. Girls hostel: 2 blocks, capacity 400 students.",
                "Rooms are double or triple sharing. Each room has beds, study tables, cupboards and Wi-Fi.",
                "First-year students are allotted rooms first; senior students are allotted rooms based on availability and CGPA."]]),
            ("Hostel Fees", [[
                "Hostel fee: Rs. 60,000 per year, including room rent and mess.",
                "Refundable caution deposit: Rs. 5,000, payable once at admission.",
                "Hostel fee is paid in two instalments with the tuition fee schedule."]]),
            ("Allotment Process", ["Apply on the hostel portal after confirming admission. Last date for hostel applications "
                "for new students: 20 July 2026. Rooms are allotted on a first come, first served basis, and room changes "
                "are allowed only with the Warden's written permission."]),
            ("Mess and Food", ["The mess serves breakfast, lunch, evening snacks and dinner. Both vegetarian and "
                "non-vegetarian options are available. Mess timings: breakfast 7:30 to 9:00 am, lunch 12:30 to 2:00 pm, "
                "snacks 5:00 to 5:30 pm, dinner 7:30 to 9:00 pm."]),
            ("Gate Timings and Visitors", [[
                "Boys hostel gate closes at 10:00 pm.",
                "Girls hostel gate closes at 9:30 pm on weekdays and 10:00 pm on weekends.",
                "Late entry needs prior written permission from the Warden.",
                "Visitors are allowed only in the visitors' area on Sundays from 4:00 pm to 6:00 pm."]]),
            ("Hostel Rules", [[
                "Cooking, electric heaters and personal refrigerators are not allowed in rooms.",
                "Smoking, alcohol and drugs are strictly prohibited and lead to immediate disciplinary action.",
                "Students must keep rooms clean and report maintenance issues to the hostel office.",
                "Ragging in any form is a punishable offence."]]),
            ("Other Facilities", ["Laundry service, a common room with television, indoor games, a gym, 24-hour security "
                "with CCTV, and a first-aid room are available. The campus health centre is open from 9:00 am to 6:00 pm."]),
        ],
    },
    {
        "category": "Library Information", "slug": "Library_Information", "title": "Central Library Information",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("About the Library", ["The Central Library has over 60,000 books, 150 print journals and access to a "
                "(fictional) digital library of e-books and research journals. It has seating for 400 readers."]),
            ("Opening Hours", [[
                "Monday to Saturday: 8:00 am to 8:00 pm.",
                "Sunday: 10:00 am to 4:00 pm.",
                "During examination weeks, the reading room stays open 24 hours a day.",
                "The library is closed on national holidays."]]),
            ("Membership and Borrowing", [[
                "Every student receives a library membership with the college ID card.",
                "A refundable library caution deposit of Rs. 3,000 is collected once with the admission fees and returned at the end of the course.",
                "Undergraduate students can borrow 4 books for 14 days.",
                "Postgraduate students can borrow 6 books for 21 days.",
                "Faculty members can borrow 10 books for 60 days.",
                "Books can be renewed twice online if no other member has reserved them."]]),
            ("Fines and Lost Books", [[
                "Late return fine: Rs. 5 per day per book.",
                "A lost book must be replaced or its current price paid, plus a processing charge of Rs. 200.",
                "Membership is suspended if fines remain unpaid for more than 30 days."]]),
            ("Digital Resources", ["The e-library can be used on campus Wi-Fi and from home through the student portal login. "
                "A plagiarism checking service for theses and project reports is available through the library on request."]),
            ("Library Rules", [[
                "Maintain silence in reading halls. Mobile phones must be on silent mode.",
                "Food and drinks are not allowed inside the library.",
                "Bags must be left at the baggage counter. Carry your ID card at all times.",
                "Reference books and journals cannot be taken out of the library."]]),
        ],
    },
    {
        "category": "Transport Facilities", "slug": "Transport_Facilities", "title": "Transport Facilities - College Buses",
        "sections": [
            ("Sample Data Notice", [INTRO + " Routes and prices are invented."]),
            ("Bus Routes", [[
                "Route 1: City Centre - Market Square - Sample Hospital - Campus. Morning pickup from 7:00 am.",
                "Route 2: Railway Station - Bus Stand - Lakeview Colony - Campus. Morning pickup from 7:15 am.",
                "Route 3: North Suburbs - Garden Road - Campus. Morning pickup from 7:10 am.",
                "Route 4: East Township - Tech Park - Campus. Morning pickup from 7:20 am."]]),
            ("Timings", ["All buses reach the campus by 8:45 am. Return buses leave the campus at 4:30 pm and 6:00 pm. "
                "On examination days, extra buses run as per the exam schedule."]),
            ("Annual Bus Fees", [[
                "Zone A (up to 8 km from campus): Rs. 15,000 per year.",
                "Zone B (8 to 15 km): Rs. 18,000 per year.",
                "Zone C (beyond 15 km): Rs. 22,000 per year.",
                "Fees are payable in two instalments along with the tuition fee schedule."]]),
            ("Bus Pass Rules", [[
                "Apply for a bus pass at the transport office with the fee receipt and a photograph.",
                "The bus pass must be shown on boarding. Passes are not transferable.",
                "A lost pass can be re-issued for Rs. 200.",
                "Change of route is allowed once per semester with the Transport Officer's approval."]]),
            ("Safety", ["Buses are fitted with GPS tracking and first-aid kits. A woman attendant travels in buses serving "
                "the girls. Students must not travel on footboards and must follow the instructions of the bus attendant."]),
            ("Transport Office", ["The Transport Officer's office is in Block D, ground floor, open Monday to Saturday, "
                "9:30 am to 4:30 pm. Email: transport@sie.example."]),
        ],
    },
    {
        "category": "Placement Information", "slug": "Placement_Information", "title": "Training and Placement Cell",
        "sections": [
            ("Sample Data Notice", [INTRO + " Placement statistics and company names are invented."]),
            ("About the Placement Cell", ["The Training and Placement Cell connects students with recruiters, organises "
                "pre-placement training and manages campus recruitment drives. The placement season begins on 1 September "
                "each year for final-year students."]),
            ("Placement Statistics 2025-26 (sample)", [[
                "Students who registered for placement: 340.",
                "Students placed: 265, which is a placement rate of 78 percent.",
                "Highest package: Rs. 18 lakh per annum.",
                "Average package: Rs. 5.4 lakh per annum.",
                "Median package: Rs. 4.8 lakh per annum.",
                "Recruiters included Sample Tech Pvt Ltd, Demo Systems, Example Analytics and Nova Sample Labs (all fictional)."]]),
            ("Eligibility for Campus Placement", [[
                "Minimum 60 percent aggregate marks or 6.5 CGPA up to the latest completed semester.",
                "No active backlogs at the time of the drive.",
                "Registration with the Placement Cell and attendance in pre-placement training sessions."]]),
            ("Placement Process", [[
                "Step 1: Company shares a job description and the eligibility criteria.",
                "Step 2: Pre-placement talk and registration of interested students.",
                "Step 3: Online or written test, followed by technical and HR interviews.",
                "Step 4: Offer letters are issued through the Placement Cell."]]),
            ("Placement Policy", ["A student who accepts an offer is generally not allowed to sit for further drives, "
                "except for a dream offer with a package at least 50 percent higher than the existing offer. Students who "
                "withdraw after accepting an offer without a valid reason may be barred from future drives."]),
            ("Training and Internships", ["Aptitude, coding and communication training is offered from semester 5. "
                "Summer internships are encouraged after semesters 4 and 6. Contact the Placement Officer at "
                "placement@sie.example."]),
        ],
    },
    {
        "category": "Scholarships", "slug": "Scholarships", "title": "Scholarships and Financial Aid",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("Merit Scholarships for New Students", [[
                "Rank 1 to 10 in the SIE-CET: 100 percent tuition fee waiver for the entire programme.",
                "Rank 11 to 50 in the SIE-CET: 50 percent tuition fee waiver.",
                "Class 12 aggregate above 90 percent: 25 percent tuition fee waiver in the first year."]]),
            ("Need-Based Scholarship", ["Students whose annual family income is below Rs. 3 lakh can receive a 30 percent "
                "tuition fee waiver. Income proof from a competent authority must be submitted."]),
            ("Other Scholarships", [[
                "Girl Child Scholarship: Rs. 10,000 per year for female students admitted to any B.Tech branch.",
                "Sports Scholarship: 20 percent tuition fee waiver for students who have represented their state or country.",
                "SIE Alumni Scholarship: Rs. 15,000 per year for two outstanding students of each branch, nominated by the department."]]),
            ("Government Scholarships", ["Students eligible for government scholarship schemes are guided by the "
                "Scholarship Cell in applying through the official portals. The institute does not guarantee approval, "
                "which depends on the government."]),
            ("Renewal Conditions", ["Merit and need-based scholarships continue only if the student maintains a CGPA of at "
                "least 8.0 and at least 75 percent attendance. A scholarship is withdrawn in case of a disciplinary action."]),
            ("How to Apply", [[
                "Submit the scholarship form to the Scholarship Cell (Block D, room 12) with marks, income and category documents.",
                "Last date to apply: 31 August 2026.",
                "A selection committee announces results by 15 September 2026.",
                "A student may combine scholarships, but total fee waiver cannot exceed 100 percent of tuition fee."]]),
        ],
    },
    {
        "category": "Rules and Regulations", "slug": "Rules_and_Regulations", "title": "Rules and Regulations - Student Code of Conduct",
        "sections": [
            ("Sample Data Notice", [INTRO]),
            ("General Conduct", [[
                "Students must carry their college ID card on campus at all times and show it when asked by staff or security.",
                "Students are expected to be respectful toward faculty, staff and fellow students.",
                "Damage to college property must be compensated by the student responsible."]]),
            ("Dress Code", ["Students should wear decent, comfortable clothing. Closed footwear is mandatory in laboratories "
                "and workshops. Formal attire is required on placement and interview days."]),
            ("Anti-Ragging Policy", ["Ragging is strictly prohibited. Any student found involved in ragging faces suspension "
                "or expulsion and may face legal action. The Anti-Ragging Committee can be reached at antiragging@sie.example "
                "or through the 24-hour helpline listed in the Contact Information document."]),
            ("Use of Mobile Phones and IT Resources", [[
                "Mobile phones must be on silent in classrooms, laboratories and the library.",
                "College computers and the campus network must be used only for academic work.",
                "Downloading pirated software, accessing offensive content and attempting to hack college systems are punishable offences.",
                "Plagiarism in assignments, projects or theses is treated as academic misconduct."]]),
            ("Leave Rules", ["Students must apply for leave in advance through their faculty advisor. For medical leave "
                "longer than 3 days, a medical certificate is required. Leave does not exempt a student from the attendance requirement."]),
            ("Disciplinary Action", ["Depending on the seriousness of the offence, action may be a written warning, a fine, "
                "suspension for a period, cancellation of hostel or bus facility, or expulsion. The Disciplinary Committee "
                "gives the student a chance to present their side."]),
            ("Grievance Redressal", ["Students can submit complaints to the Grievance Redressal Cell through the box outside "
                "the administration block or by writing to grievance@sie.example. The Cell responds within 10 working days."]),
        ],
    },
    {
        "category": "Contact Information", "slug": "Contact_Information", "title": "Contact Information",
        "sections": [
            ("Sample Data Notice", [INTRO + " Addresses, phone numbers and e-mail addresses are placeholders; none are real."]),
            ("Address", ["Sample Institute of Engineering, 123 Sample Road, Sampleville, Exampleland, PIN 000000."]),
            ("Main Office", [[
                "Phone: +00 000 000 0001 (placeholder).",
                "E-mail: office@sie.example.",
                "Office hours: Monday to Friday 9:30 am to 5:00 pm, Saturday 9:30 am to 1:00 pm. Closed on Sundays and national holidays."]]),
            ("Offices and Departments", [[
                "Admission Office: admissions@sie.example, phone +00 000 000 0002.",
                "Examination Cell: exams@sie.example, phone +00 000 000 0003.",
                "Accounts and Fee Section: accounts@sie.example, phone +00 000 000 0004.",
                "Training and Placement Cell: placement@sie.example, phone +00 000 000 0005.",
                "Scholarship Cell: scholarship@sie.example.",
                "Transport Office: transport@sie.example.",
                "Library: library@sie.example.",
                "Hostel Warden (boys): wardenboys@sie.example. Hostel Warden (girls): wardengirls@sie.example."]]),
            ("Department Offices", [[
                "CSE and CSE-AI: cse@sie.example, Block A, first floor.",
                "ECE: ece@sie.example, Block B, first floor.",
                "Mechanical and Civil Engineering: mechcivil@sie.example, Block C, ground floor."]]),
            ("Emergency and Helplines", [[
                "Campus security (24 hours): +00 000 000 0100 (placeholder).",
                "Anti-ragging helpline (24 hours): +00 000 000 0101 (placeholder).",
                "Health centre: +00 000 000 0102 (placeholder), open 9:00 am to 6:00 pm."]]),
            ("Grievances", ["Write to grievance@sie.example. The Grievance Redressal Cell responds within 10 working days."]),
        ],
    },
]
