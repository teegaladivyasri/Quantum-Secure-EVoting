import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'te' | 'hi';

interface Translations {
  [key: string]: {
    en: string;
    te: string;
    hi: string;
  };
}

export const translations: Translations = {
  // Navigation & App Header
  systemTitle: {
    en: "Quantum-Secure Electronic Voting System",
    te: "క్వాంటమ్-రక్షిత ఎలక్ట్రానిక్ ఓటింగ్ విధానం",
    hi: "क्वांटम-सुरक्षित इलेक्ट्रॉनिक मतदान प्रणाली"
  },
  home: {
    en: "Home",
    te: "హోమ్",
    hi: "होम"
  },
  dashboard: {
    en: "Dashboard",
    te: "డాష్‌బోర్డ్",
    hi: "डैशबोर्ड"
  },
  login: {
    en: "Sign In",
    te: "సైన్ ఇన్",
    hi: "साइन इन"
  },
  logout: {
    en: "Sign Out",
    te: "లాగ్ అవుట్",
    hi: "लॉग आउट"
  },

  // Voter Authentication Flow (Phase 9B)
  voterSignInTitle: {
    en: "Voter Sign In",
    te: "ఓటరు సైన్ ఇన్",
    hi: "मतदाता साइन इन"
  },
  voterSignInSubtitle: {
    en: "Enter your official Voter ID to access your civic electronic ballot",
    te: "మీ ఎలక్ట్రానిక్ బ్యాలెట్‌ను యాక్సెస్ చేయడానికి మీ అధికారిక ఓటరు IDని నమోదు చేయండి",
    hi: "अपने इलेक्ट्रॉनिक मतपत्र तक पहुँचने के लिए अपनी आधिकारिक मतदाता पहचान दर्ज करें"
  },
  voterIdLabel: {
    en: "Voter ID",
    te: "ఓటరు ID",
    hi: "मतदाता पहचान"
  },
  voterIdPlaceholder: {
    en: "e.g. VTR-2026-00101",
    te: "ఉదా. VTR-2026-00101",
    hi: "उदा. VTR-2026-00101"
  },
  continueBtn: {
    en: "Continue",
    te: "కొనసాగించండి",
    hi: "आगे बढ़ें"
  },
  mobileVerificationTitle: {
    en: "Verify Your Mobile",
    te: "మీ మొబైల్‌ను ధృవీకరించండి",
    hi: "अपना मोबाइल सत्यापित करें"
  },
  mobileVerificationDesc: {
    en: "We sent a verification code to your registered mobile number ending in",
    te: "దీనితో ముగిసే మీ రిజిస్టర్డ్ మొబైల్ నంబరుకు ధృవీకరణ కోడ్ పంపబడింది:",
    hi: "पंजीकृत मोबाइल नंबर पर एक सत्यापन कोड भेजा गया है जो समाप्त होता है:"
  },
  enterSixDigitOtp: {
    en: "Enter 6-Digit OTP",
    te: "6 అంకెల OTP నమోదు చేయండి",
    hi: "6-अंकीय OTP दर्ज करें"
  },
  verifyOtpBtn: {
    en: "Verify OTP",
    te: "OTP ధృవీకరించండి",
    hi: "OTP सत्यापित करें"
  },
  resendOtpBtn: {
    en: "Resend OTP",
    te: "OTP మళ్లీ పంపండి",
    hi: "OTP पुनः भेजें"
  },
  resendWaitNotice: {
    en: "Resend code in",
    te: "మళ్లీ పంపడానికి వేచి ఉండండి:",
    hi: "कोड पुनः भेजने में प्रतीक्षा करें:"
  },
  prototypeIdentityTitle: {
    en: "Prototype Identity Verification",
    te: "ప్రోటోటైప్ గుర్తింపు ధృవీకరణ",
    hi: "प्रोटोटाइप पहचान सत्यापन"
  },
  prototypeIdentityDisclaimer: {
    en: "Academic Research Prototype — Synthetic Verification Only. Not connected to UIDAI Aadhaar, the Election Commission of India, or any government biometric database.",
    te: "అకడమిక్ రీసెర్చ్ ప్రోటోటైప్ — సింథటిక్ వెరిఫికేషన్ మాత్రమే. ఇది UIDAI ఆధార్, భారత ఎన్నికల సంఘం లేదా ప్రభుత్వ బయోమెట్రిక్ డేటాబేస్‌లతో అనుసంధానించబడలేదు.",
    hi: "अकादमिक अनुसंधान प्रोटोटाइप — केवल कृत्रिम सत्यापन। यह यूआईडीएआई आधार, भारत निर्वाचन आयोग या किसी भी सरकारी बायोमेट्रिक डेटाबेस से संबद्ध नहीं है।"
  },
  cameraInstruction: {
    en: "Position your face within the frame.",
    te: "ఫ్రేమ్‌లో మీ ముఖాన్ని ఉంచండి.",
    hi: "फ्रेम के भीतर अपना चेहरा रखें।"
  },
  captureAndVerifyBtn: {
    en: "Capture & Verify",
    te: "క్యాప్చర్ చేసి ధృవీకరించండి",
    hi: "चित्र लें और सत्यापित करें"
  },
  demoIdentityBtn: {
    en: "Demo Identity Verification",
    te: "డెమో గుర్తింపు ధృవీకరణ",
    hi: "डेमो पहचान सत्यापन"
  },
  demoFallbackNotice: {
    en: "Simulation Mode: Verifies demonstration identity for devices without webcam support.",
    te: "సిమ్యులేషన్ మోడ్: కెమెరా లేని పరికరాల కోసం ప్రదర్శన గుర్తింపును ధృవీకరిస్తుంది.",
    hi: "सिमुलेशन मोड: बिना वेबकैम वाले उपकरणों के लिए प्रदर्शन पहचान सत्यापित करता है।"
  },
  verificationSuccessfulTitle: {
    en: "Verification Successful",
    te: "ధృవీకరణ విజయవంతమైంది",
    hi: "सत्यापन सफल रहा"
  },
  verificationSuccessfulDesc: {
    en: "Your identity has been confirmed. Redirecting to your official ballot dashboard...",
    te: "మీ గుర్తింపు ధృవీకరించబడింది. అధికారిక బ్యాలెట్ డాష్‌బోర్డ్‌కు దారి మళ్లిస్తోంది...",
    hi: "आपकी पहचान की पुष्टि हो गई है। आधिकारिक मतपत्र डैशबोर्ड पर ले जाया जा रहा है..."
  },
  adminLoginTitle: {
    en: "Administrator Login",
    te: "అడ్మినిస్ట్రేటర్ లాగిన్",
    hi: "व्यवस्थापक लॉगिन"
  },
  adminLoginSubtitle: {
    en: "Official credential access for election administration staff only",
    te: "ఎన్నికల నిర్వహణ సిబ్బందికి మాత్రమే అధికారిక ఆధారాల ప్రవేశం",
    hi: "केवल चुनाव प्रशासन कर्मचारियों के लिए आधिकारिक क्रेडेंशियल पहुँच"
  },
  switchToAdminLogin: {
    en: "Election Official Access",
    te: "ఎన్నికల అధికారి ప్రవేశం",
    hi: "चुनाव अधिकारी पहुँच"
  },
  switchToVoterLogin: {
    en: "Return to Voter Sign In",
    te: "ఓటరు సైన్ ఇన్‌కు తిరిగి వెళ్ళండి",
    hi: "मतदाता साइन इन पर लौटें"
  },
  cameraAccessDenied: {
    en: "Camera access was declined or is unavailable. You may use Demo Identity Verification below.",
    te: "కెమెరా అనుమతి లభించలేదు లేదా అందుబాటులో లేదు. దిగువ డెమో గుర్తింపు ధృవీకరణను ఉపయోగించవచ్చు.",
    hi: "कैमरा पहुँच अस्वीकृत या अनुपलब्ध है। आप नीचे दिए गए डेमो पहचान सत्यापन का उपयोग कर सकते हैं।"
  },

  // Phase 10 — Voter Dashboard & Election Experience
  identityVerifiedBadge: {
    en: "Identity Verified",
    te: "గుర్తింపు ధృవీకరించబడింది",
    hi: "पहचान सत्यापित"
  },
  activeElectionBadge: {
    en: "Official Civic Election",
    te: "అధికారిక పౌర ఎన్నికలు",
    hi: "आधिकारिक नागरिक चुनाव"
  },
  electionStatusActive: {
    en: "Active • Voting Open",
    te: "సక్రియం • ఓటింగ్ ప్రారంభమైంది",
    hi: "सक्रिय • मतदान खुला है"
  },
  eligibleCandidatesCount: {
    en: "Eligible Candidates in your Constituency",
    te: "మీ నియోజకవర్గంలో పోటీ చేస్తున్న అభ్యర్థులు",
    hi: "आपके निर्वाचन क्षेत्र में पात्र उम्मीदवार"
  },
  beforeYouVoteTitle: {
    en: "Before You Vote",
    te: "మీరు ఓటు వేయడానికి ముందు ముఖ్య సూచనలు",
    hi: "वोट डालने से पहले महत्वपूर्ण निर्देश"
  },
  beforeYouVoteSubtitle: {
    en: "Please read these simple guidelines before accessing your electronic ballot.",
    te: "మీ ఎలక్ట్రానిక్ బ్యాలెట్ పత్రాన్ని తెరవడానికి ముందు ఈ మార్గదర్శకాలను చదవండి.",
    hi: "अपना इलेक्ट्रॉनिक मतपत्र खोलने से पहले इन सरल दिशानिर्देशों को पढ़ें।"
  },
  votingInstruction1: {
    en: "1. Review the eligible candidates in your assigned constituency carefully.",
    te: "1. మీ నియోజకవర్గంలో పోటీ చేస్తున్న అభ్యర్థుల వివరాలను జాగ్రత్తగా పరిశీలించండి.",
    hi: "1. अपने निर्दिष्ट निर्वाचन क्षेत्र के पात्र उम्मीदवारों की सावधानीपूर्वक समीक्षा करें।"
  },
  votingInstruction2: {
    en: "2. Select the candidate you wish to vote for on your official electronic ballot.",
    te: "2. మీ అధికారిక ఎలక్ట్రానిక్ బ్యాలెట్‌పై మీరు ఎంచుకోవాలనుకుంటున్న అభ్యర్థిని ఎంపిక చేయండి.",
    hi: "2. अपने आधिकारिक इलेक्ट्रॉनिक मतपत्र पर उस उम्मीदवार का चयन करें जिसे आप वोट देना चाहते हैं।"
  },
  votingInstruction3: {
    en: "3. Verify your selection in the review window before final submission.",
    te: "3. తుది సమర్పణకు ముందు నిర్ధారణ విండోలో మీ ఎంపికను సరిచూసుకోండి.",
    hi: "3. अंतिम प्रस्तुति से पहले समीक्षा विंडो में अपने चयन की पुष्टि करें।"
  },
  votingInstruction4: {
    en: "4. Once submitted, your vote is securely recorded and cannot be altered or re-cast.",
    te: "4. ఒకసారి సమర్పించిన తర్వాత మీ ఓటు సురక్షితంగా నమోదవుతుంది, దానిని మార్చడం సాధ్యం కాదు.",
    hi: "4. एक बार जमा करने के बाद आपका वोट सुरक्षित रूप से दर्ज हो जाता है और इसे बदला नहीं जा सकता।"
  },
  startVotingBtn: {
    en: "Start Voting",
    te: "ఓటింగ్ ప్రారంభించండి",
    hi: "मतदान शुरू करें"
  },
  viewCandidatesBtn: {
    en: "View Candidates",
    te: "అభ్యర్థులను చూడండి",
    hi: "उम्मीदवार देखें"
  },
  candidateDetailsTitle: {
    en: "Candidate Details",
    te: "అభ్యర్థి సమాచారం",
    hi: "उम्मीदवार का विवरण"
  },
  candidateCardDetailsBtn: {
    en: "View Details",
    te: "వివరాలు చూడండి",
    hi: "विवरण देखें"
  },
  closeDetailsBtn: {
    en: "Close Details",
    te: "వివరాలు మూసివేయి",
    hi: "विवरण बंद करें"
  },
  voteAlreadySubmittedTitle: {
    en: "Vote Already Submitted",
    te: "ఓటు ఇప్పటికే నమోదు చేయబడింది",
    hi: "वोट पहले ही जमा किया जा चुका है"
  },
  voteAlreadySubmittedDesc: {
    en: "You have already cast your ballot in this election. To protect voter privacy, candidate choices are never displayed.",
    te: "ఈ ఎన్నికల్లో మీరు ఇప్పటికే మీ ఓటు వేశారు. ఓటరు గోప్యతను కాపాడటానికి, ఎంపిక చేసిన అభ్యర్థి వివరాలు ప్రదర్శించబడవు.",
    hi: "आपने इस चुनाव में पहले ही अपना वोट डाल दिया है। गोपनीयता की रक्षा के लिए उम्मीदवार की पसंद कभी प्रदर्शित नहीं की जाती है।"
  },
  notEligibleTitle: {
    en: "Not Eligible to Vote",
    te: "ఓటు వేయడానికి అర్హత లేదు",
    hi: "मतदान के पात्र नहीं"
  },
  notEligibleDesc: {
    en: "You are not currently eligible to vote in this election. Please contact your local election authority.",
    te: "ఈ ఎన్నికల్లో ఓటు వేయడానికి మీకు ప్రస్తుతం అనుమతి లేదు. దయచేసి మీ స్థానిక ఎన్నికల అధికారిని సంప్రదించండి.",
    hi: "आप वर्तमान में इस चुनाव में मतदान करने के लिए पात्र नहीं हैं। कृपया अपने स्थानीय चुनाव अधिकारी से संपर्क करें।"
  },
  errorLoadingElection: {
    en: "We couldn't load the election information. Please try again.",
    te: "ఎన్నికల సమాచారాన్ని లోడ్ చేయడం సాధ్యం కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",
    hi: "हम चुनाव की जानकारी लोड नहीं कर सके। कृपया पुनः प्रयास करें।"
  },
  retryLoadingBtn: {
    en: "Retry",
    te: "మళ్లీ ప్రయత్నించండి",
    hi: "पुनः प्रयास करें"
  },
  sessionExpiredNotice: {
    en: "Your session has expired. Please sign in again.",
    te: "మీ సెషన్ గడువు ముగిసింది. దయచేసి మళ్లీ లాగిన్ అవ్వండి.",
    hi: "आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।"
  },
  accessDeniedNotice: {
    en: "You are not authorized to access this voting area.",
    te: "ఈ ఓటింగ్ విభాగాన్ని యాక్సెస్ చేయడానికి మీకు అనుమతి లేదు.",
    hi: "आप इस मतदान क्षेत्र तक पहुँचने के लिए अधिकृत नहीं हैं।"
  },
  candidateOfficialNominee: {
    en: "Official Nominee",
    te: "అధికారిక అభ్యర్థి",
    hi: "आधिकारिक उम्मीदवार"
  },
  hearInstructionsBtn: {
    en: "Listen to Instructions",
    te: "సూచనలు వినండి",
    hi: "निर्देश सुनें"
  },


  audioGuideOn: {
    en: "Audio Guide Active",
    te: "ఆడియో గైడ్ సక్రియం",
    hi: "ऑडियो गाइड सक्रिय"
  },
  audioGuideOff: {
    en: "Audio Guide Inactive",
    te: "ఆడియో గైడ్ నిష్క్రియం",
    hi: "ऑडियो गाइड निष्क्रिय"
  },
  lightMode: {
    en: "Light Mode",
    te: "లైట్ మోడ్",
    hi: "लाइट मोड"
  },
  darkMode: {
    en: "Dark Mode",
    te: "డార్క్ మోడ్",
    hi: "डार्क मोड"
  },
  howItWorks: {
    en: "How It Works",
    te: "ఇది ఎలా పనిచేస్తుంది",
    hi: "यह कैसे काम करता है"
  },
  securityNav: {
    en: "Security",
    te: "భద్రత",
    hi: "सुरक्षा"
  },

  // Phase 10.6 — High-End Editorial Civic Technology Identity
  heroEyebrow: {
    en: "QUANTUM-SECURE • RESEARCH PROTOTYPE",
    te: "క్వాంటమ్-రక్షిత • పరిశోధనా నమూనా",
    hi: "क्वांटम-सुरक्षित • अनुसंधान प्रोटोटाइप"
  },
  heroTitle: {
    en: "YOUR VOTE.\nYOUR VOICE.\nPROTECTED\nBY DESIGN.",
    te: "మీ ఓటు.\nమీ గళం.\nరూపకల్పన ద్వారా\nరక్షించబడింది.",
    hi: "आपका वोट।\nआपकी आवाज़।\nडिज़ाइन द्वारा\nसुरक्षित।"
  },
  heroSubtitle: {
    en: "An academic research prototype exploring secure electronic voting through modern voter verification, protected ballot handling, and simulated quantum key distribution.",
    te: "ఆధునిక ఓటరు ధృవీకరణ, రక్షిత బ్యాలెట్ నిర్వహణ మరియు సిమ్యులేటెడ్ క్వాంటమ్ కీ డిస్ట్రిబ్యూషన్ ద్వారా సురక్షిత ఎలక్ట్రానిక్ ఓటింగ్‌ను అన్వేషించే విద్యా పరిశోధనా నమూనా.",
    hi: "आधुनिक मतदाता सत्यापन, सुरक्षित मतपत्र प्रबंधन और सिम्युलेटेड क्वांटम कुंजी वितरण के माध्यम से सुरक्षित इलेक्ट्रॉनिक मतदान की खोज करने वाला एक अकादमिक अनुसंधान प्रोटोटाइप।"
  },
  heroPrimaryCta: {
    en: "ENTER VOTING PORTAL",
    te: "ఓటింగ్ పోర్టల్ ప్రవేశించండి",
    hi: "मतदान पोर्टल में प्रवेश करें"
  },
  heroSecondaryCta: {
    en: "EXPLORE HOW IT WORKS",
    te: "ఇది ఎలా పనిచేస్తుందో చూడండి",
    hi: "जानें यह कैसे काम करता है"
  },
  audioOverviewBtn: {
    en: "Listen to Overview",
    te: "ఆడియో పరిచయం వినండి",
    hi: "ऑडियो विवरण सुनें"
  },
  landingSpokenOverview: {
    en: "Welcome to the Quantum-Secure Electronic Voting System research prototype. Secure technology should feel simple to the voter. The prototype demonstrates modern voter verification, protected ballot handling, and simulated quantum key distribution.",
    te: "క్వాంటమ్-రక్షిత ఎలక్ట్రానిక్ ఓటింగ్ సిస్టమ్ పరిశోధనా నమూనాకు స్వాగతం. సురక్షిత సాంకేతికత ఓటరుకు సులభంగా అనిపించాలి. ఈ నమూనా ఆధునిక ఓటరు ధృవీకరణ, రక్షిత బ్యాలెట్ నిర్వహణ మరియు క్వాంటమ్ కీ పంపిణీ అనుకరణను ప్రదర్శిస్తుంది.",
    hi: "क्वांटम-सुरक्षित इलेक्ट्रॉनिक वोटिंग सिस्टम अनुसंधान प्रोटोटाइप में आपका स्वागत है। सुरक्षित तकनीक मतदाता के लिए सरल महसूस होनी चाहिए। यह प्रोटोटाइप आधुनिक मतदाता सत्यापन, सुरक्षित मतपत्र प्रबंधन और क्वांटम कुंजी वितरण सिमुलेशन को प्रदर्शित करता है।"
  },
  signInBtn: {
    en: "Sign In",
    te: "సైన్ ఇన్",
    hi: "साइन इन"
  },
  enterVoterPortal: {
    en: "Enter Voting Portal",
    te: "ఓటింగ్ పోర్టల్ ప్రవేశించండి",
    hi: "मतदान पोर्टल में प्रवेश करें"
  },
  enterAdminPortal: {
    en: "Administrator Portal",
    te: "అడ్మినిస్ట్రేటర్ పోర్టల్",
    hi: "प्रशासक पोर्टल"
  },

  // Abstract Ballot Visual Design Object (No fake candidates)
  ballotMockHeading: {
    en: "GENERAL ASSEMBLY ELECTION",
    te: "సాధారణ శాసనసభ ఎన్నికలు",
    hi: "साधारण विधानसभा चुनाव"
  },
  ballotMockYear: {
    en: "2026",
    te: "2026",
    hi: "2026"
  },
  ballotMockWard: {
    en: "WARD-1",
    te: "వార్డు-1",
    hi: "वार्ड-1"
  },
  ballotMockType: {
    en: "BALLOT",
    te: "బ్యాలెట్",
    hi: "मतपत्र"
  },
  ballotMockOptionLabel: {
    en: "OPTION",
    te: "ఎంపిక",
    hi: "विकल्प"
  },
  ballotMockStatus: {
    en: "PROTECTED",
    te: "రక్షితం",
    hi: "सुरक्षित"
  },

  // Section 01 — What Are We Protecting?
  protectingNumber: {
    en: "01",
    te: "01",
    hi: "01"
  },
  protectingTitle: {
    en: "WHAT ARE WE\nPROTECTING?",
    te: "మనం వేటిని\nరక్షిస్తున్నాము?",
    hi: "हम किसकी\nरक्षा कर रहे हैं?"
  },
  protectingSubtitle: {
    en: "An electronic vote has two important sides:\nthe person participating, and the ballot they cast.",
    te: "ఎలక్ట్రానిక్ ఓటుకు రెండు ముఖ్యమైన అంశాలు ఉన్నాయి:\nపాల్గొనే వ్యక్తి మరియు వారు వేసే బ్యాలెట్.",
    hi: "एक इलेक्ट्रॉनिक वोट के दो महत्वपूर्ण पहलू हैं:\nभाग लेने वाला व्यक्ति और उनके द्वारा डाला गया मतपत्र।"
  },
  voterColumnTitle: {
    en: "VOTER",
    te: "ఓటరు",
    hi: "मतदाता"
  },
  voterItem1: {
    en: "Identity",
    te: "గుర్తింపు",
    hi: "पहचान"
  },
  voterItem2: {
    en: "Eligibility",
    te: "అర్హత",
    hi: "पात्रता"
  },
  voterItem3: {
    en: "Participation",
    te: "భాగస్వామ్యం",
    hi: "भागीदारी"
  },
  ballotColumnTitle: {
    en: "BALLOT",
    te: "బ్యాలెట్",
    hi: "मतपत्र"
  },
  ballotItem1: {
    en: "Candidate choice",
    te: "అభ్యర్థి ఎంపిక",
    hi: "उम्मीदवार चयन"
  },
  ballotItem2: {
    en: "Protection",
    te: "రక్షణ",
    hi: "सुरक्षा"
  },
  ballotItem3: {
    en: "Storage",
    te: "నిల్వ",
    hi: "भंडारण"
  },
  flowVoter: {
    en: "VOTER",
    te: "ఓటరు",
    hi: "मतदाता"
  },
  flowVerification: {
    en: "VERIFICATION",
    te: "ధృవీకరణ",
    hi: "सत्यापन"
  },
  flowEligibility: {
    en: "ELIGIBILITY",
    te: "అర్హత",
    hi: "पात्रता"
  },
  flowBallot: {
    en: "BALLOT",
    te: "బ్యాలెట్",
    hi: "मतपत्र"
  },
  flowProtectedStorage: {
    en: "PROTECTED STORAGE",
    te: "రక్షిత నిల్వ",
    hi: "सुरक्षित भंडारण"
  },
  conceptVerifyTitle: {
    en: "VERIFY",
    te: "ధృవీకరణ",
    hi: "सत्यापन"
  },
  conceptVerifyDesc: {
    en: "Confirm that the voter is authorized to participate.",
    te: "ఓటరు పాల్గొనడానికి అనుమతించబడ్డారని నిర్ధారించండి.",
    hi: "पुष्टि करें कि मतदाता भाग लेने के लिए अधिकृत है।"
  },
  conceptEligibilityTitle: {
    en: "ELIGIBILITY",
    te: "అర్హత",
    hi: "पात्रता"
  },
  conceptEligibilityDesc: {
    en: "Show the election and candidates assigned to the voter's constituency.",
    te: "ఓటరు నియోజకవర్గానికి కేటాయించిన ఎన్నికలు మరియు అభ్యర్థులను మాత్రమే చూపండి.",
    hi: "मतदाता के निर्वाचन क्षेत्र के लिए निर्दिष्ट चुनाव और उम्मीदवार प्रदर्शित करें।"
  },
  conceptProtectTitle: {
    en: "PROTECT",
    te: "రక్షణ",
    hi: "सुरक्षा"
  },
  conceptProtectDesc: {
    en: "Protect the ballot before it is stored.",
    te: "బ్యాలెట్‌ను భద్రపరచడానికి ముందే రక్షించండి.",
    hi: "मतपत्र को संग्रहीत करने से पहले सुरक्षित करें।"
  },
  conceptSeparateTitle: {
    en: "SEPARATE",
    te: "విభజన",
    hi: "पृथक्करण"
  },
  conceptSeparateDesc: {
    en: "Keep participation information separate from stored ballot data.",
    te: "ఓటరు భాగస్వామ్య సమాచారాన్ని భద్రపరచబడిన బ్యాలెట్ డేటా నుండి వేరుగా ఉంచండి.",
    hi: "मतदाता भागीदारी की जानकारी को संग्रहीत मतपत्र डेटा से अलग रखें।"
  },

  // Section 02 — The Central Idea (Full-Width Black Section)
  section02Number: {
    en: "02",
    te: "02",
    hi: "02"
  },
  simplicityLine1: {
    en: "THE VOTER SEES\nSIMPLICITY.",
    te: "ఓటరు సరళతను\nచూస్తారు.",
    hi: "मतदाता को सरलता\nदिखाई देती है।"
  },
  simplicityLine2: {
    en: "THE SYSTEM HANDLES\nTHE COMPLEXITY.",
    te: "వ్యవస్థ సంక్లిష్టతను\nనిర్వహిస్తుంది.",
    hi: "प्रणाली जटिलता को\nसंभालती है।"
  },
  simplicityTitle: {
    en: "THE VOTER SEES SIMPLICITY.\nTHE SYSTEM HANDLES THE COMPLEXITY.",
    te: "ఓటరు సరళతను చూస్తారు.\nవ్యవస్థ సంక్లిష్టతను నిర్వహిస్తుంది.",
    hi: "मतदाता को सरलता दिखाई देती है।\nप्रणाली जटिलता को संभालती है।"
  },
  simplicityDesc: {
    en: "Behind the simple voting experience, the prototype combines authentication, eligibility checks, BB84-based key establishment simulation, QBER assessment, and AES-256-GCM authenticated encryption.",
    te: "సాధారణ ఓటింగ్ అనుభవం వెనుక, ఈ నమూనా ప్రమాణీకరణ, అర్హత తనిఖీలు, BB84-ఆధారిత కీ స్థాపన అనుకరణ, QBER అంచనా మరియు AES-256-GCM ప్రామాణిక ఎన్‌క్రిప్షన్‌ను మిళితం చేస్తుంది.",
    hi: "सरल मतदान अनुभव के पीछे, यह प्रोटोटाइप प्रमाणीकरण, पात्रता जांच, BB84-आधारित कुंजी स्थापना सिमुलेशन, QBER मूल्यांकन और AES-256-GCM प्रमाणित एन्क्रिप्शन को जोड़ता है।"
  },
  qflow1Title: {
    en: "BB84 SIMULATION",
    te: "BB84 అనుకరణ",
    hi: "BB84 सिमुलेशन"
  },
  qflow1Desc: {
    en: "Simulated quantum key establishment",
    te: "సిమ్యులేటెడ్ క్వాంటమ్ కీ స్థాపన",
    hi: "सिम्युलेटेड क्वांटम कुंजी स्थापना"
  },
  qflow2Title: {
    en: "QBER CHECK",
    te: "QBER తనిఖీ",
    hi: "QBER जांच"
  },
  qflow2Desc: {
    en: "Checks observed channel disturbance",
    te: "గమనించిన ఛానెల్ అంతరాయాన్ని తనిఖీ చేస్తుంది",
    hi: "अवलोकित चैनल व्यवधान की जांच करता है"
  },
  qflow3Title: {
    en: "256 USABLE BITS",
    te: "256 ఉపయోగకరమైన బిట్లు",
    hi: "256 उपयोगी बिट्स"
  },
  qflow3Desc: {
    en: "Usable key material is selected",
    te: "ఉపయోగించదగిన కీ మెటీరియల్ ఎంపిక చేయబడుతుంది",
    hi: "उपयोगी कुंजी सामग्री का चयन किया जाता है"
  },
  qflow4Title: {
    en: "AES-256-GCM",
    te: "AES-256-GCM",
    hi: "AES-256-GCM"
  },
  qflow4Desc: {
    en: "Ballot is authenticated and encrypted",
    te: "బ్యాలెట్ ప్రామాణీకరించబడి ఎన్‌క్రిప్ట్ చేయబడుతుంది",
    hi: "मतपत्र प्रमाणित और एन्क्रिप्ट किया जाता है"
  },
  qflow5Title: {
    en: "PROTECTED BALLOT",
    te: "రక్షిత బ్యాలెట్",
    hi: "सुरक्षित मतपत्र"
  },
  qflow5Desc: {
    en: "Protected data is stored separately from voter participation data",
    te: "రక్షిత డేటా ఓటరు భాగస్వామ్య డేటా నుండి వేరుగా భద్రపరచబడుతుంది",
    hi: "सुरक्षित डेटा को मतदाता भागीदारी डेटा से अलग संग्रहीत किया जाता है"
  },

  // "How Does a Voter Use It?" (7 Steps Journey)
  journeyTitle: {
    en: "How Does a Voter Use It?",
    te: "ఓటరు దీనిని ఎలా ఉపయోగిస్తారు?",
    hi: "मतदाता इसका उपयोग कैसे करते हैं?"
  },
  journeySubtitle: {
    en: "A clear, sequential path from identification to protected ballot submission.",
    te: "గుర్తింపు నుండి రక్షిత బ్యాలెట్ సమర్పణ వరకు స్పష్టమైన వరుస క్రమం.",
    hi: "पहचान से लेकर सुरक्षित मतपत्र जमा करने तक का एक स्पष्ट क्रम।"
  },
  journeyStep1: {
    en: "01 — Enter Voter ID",
    te: "01 — ఓటరు ID నమోదు",
    hi: "01 — मतदाता पहचान दर्ज करें"
  },
  journeyStep1Hint: {
    en: "Identify your registered voter record.",
    te: "మీ రిజిస్టర్డ్ ఓటరు రికార్డును గుర్తించండి.",
    hi: "अपने पंजीकृत मतदाता रिकॉर्ड की पहचान करें।"
  },
  journeyStep2: {
    en: "02 — Verify OTP",
    te: "02 — OTP ధృవీకరించండి",
    hi: "02 — OTP सत्यापित करें"
  },
  journeyStep2Hint: {
    en: "Confirm access using the registered verification step.",
    te: "రిజిస్టర్డ్ ధృవీకరణ దశ ద్వారా ప్రవేశాన్ని నిర్ధారించండి.",
    hi: "पंजीकृत सत्यापन चरण के माध्यम से पहुँच की पुष्टि करें।"
  },
  journeyStep3: {
    en: "03 — Verify Identity",
    te: "03 — గుర్తింపు ధృవీకరణ",
    hi: "03 — पहचान सत्यापित करें"
  },
  journeyStep3Hint: {
    en: "Complete the prototype identity verification step.",
    te: "ప్రోటోటైప్ గుర్తింపు ధృవీకరణ దశను పూర్తి చేయండి.",
    hi: "प्रोटोटाइप पहचान सत्यापन चरण पूरा करें।"
  },
  journeyStep4: {
    en: "04 — View Your Election",
    te: "04 — మీ ఎన్నికలు చూడండి",
    hi: "04 — अपना चुनाव देखें"
  },
  journeyStep4Hint: {
    en: "See the election and candidates assigned to your constituency.",
    te: "మీ నియోజకవర్గానికి కేటాయించిన ఎన్నికలు మరియు అభ్యర్థులను చూడండి.",
    hi: "अपने निर्वाचन क्षेत्र के लिए निर्दिष्ट चुनाव और उम्मीदवार देखें।"
  },
  journeyStep5: {
    en: "05 — Choose Candidate",
    te: "05 — అభ్యర్థిని ఎంచుకోండి",
    hi: "05 — उम्मीदवार चुनें"
  },
  journeyStep5Hint: {
    en: "Select one eligible candidate.",
    te: "ఒక అర్హత కలిగిన అభ్యర్థిని ఎంపిక చేయండి.",
    hi: "एक पात्र उम्मीदवार का चयन करें।"
  },
  journeyStep6: {
    en: "06 — Review & Confirm",
    te: "06 — సమీక్షించి నిర్ధారించండి",
    hi: "06 — समीक्षा और पुष्टि करें"
  },
  journeyStep6Hint: {
    en: "Check your selection before submission.",
    te: "సమర్పించడానికి ముందు మీ ఎంపికను సరిచూసుకోండి.",
    hi: "जमा करने से पहले अपने चयन की जांच करें।"
  },
  journeyStep7: {
    en: "07 — Vote Submitted",
    te: "07 — ఓటు సమర్పించబడింది",
    hi: "07 — वोट जमा किया गया"
  },
  journeyStep7Hint: {
    en: "Your ballot is securely processed.",
    te: "మీ బ్యాలెట్ సురక్షితంగా ప్రాసెస్ చేయబడింది.",
    hi: "आपका मतपत्र सुरक्षित रूप से संसाधित किया गया है।"
  },

  // Interactive Walkthrough Guide
  howToVoteTitle: {
    en: "Interactive Walkthrough",
    te: "ఇంటరాక్టివ్ గైడ్ ప్రదర్శన",
    hi: "इंटरैक्टिव वॉकथ्रू गाइड"
  },
  howToVoteSubtitle: {
    en: "Step-by-step preview of the complete voter experience.",
    te: "పూర్తి ఓటరు అనుభవం యొక్క దశల వారీ ప్రివ్యూ.",
    hi: "संपूर्ण मतदाता अनुभव का चरण-दर-चरण पूर्वावलोकन।"
  },
  interactiveTutorial: {
    en: "Interactive Walkthrough Guide",
    te: "ఇంటరాక్టివ్ గైడ్ ప్రదర్శన",
    hi: "इंटरैक्टिव वॉकथ्रू गाइड"
  },
  stepOf: {
    en: "Step",
    te: "దశ",
    hi: "चरण"
  },
  prevStep: {
    en: "Previous Step",
    te: "మునుపటి దశ",
    hi: "पिछला चरण"
  },
  nextStep: {
    en: "Next Step",
    te: "తరువాతి దశ",
    hi: "अगला चरण"
  },
  resetWalkthrough: {
    en: "Restart Guide",
    te: "తిరిగి ప్రారంభించండి",
    hi: "पुनः प्रारंभ करें"
  },
  videoSimNotice: {
    en: "Civic Research Prototype Walkthrough • Standard electronic voting flow",
    te: "పౌర పరిశోధనా నమూనా మార్గదర్శకం • ప్రామాణిక ఎలక్ట్రానిక్ ఓటింగ్ విధానం",
    hi: "नागरिक अनुसंधान प्रोटोटाइप वॉकथ्रू • मानक इलेक्ट्रॉनिक मतदान प्रक्रिया"
  },
  workflowStep1Title: {
    en: "1. Enter Voter ID",
    te: "1. ఓటరు ID నమోదు చేయండి",
    hi: "1. मतदाता पहचान दर्ज करें"
  },
  workflowStep1Desc: {
    en: "Identify your registered voter record to initiate the session.",
    te: "సెషన్‌ను ప్రారంభించడానికి మీ నమోదిత ఓటరు రికార్డును నమోదు చేయండి.",
    hi: "सत्र शुरू करने के लिए अपना पंजीकृत मतदाता रिकॉर्ड दर्ज करें।"
  },
  workflowStep2Title: {
    en: "2. Verify OTP",
    te: "2. OTP ధృవీకరించండి",
    hi: "2. OTP सत्यापित करें"
  },
  workflowStep2Desc: {
    en: "Confirm access using the registered verification step.",
    te: "రిజిస్టర్డ్ ధృవీకరణ దశ ద్వారా ప్రవేశాన్ని నిర్ధారించండి.",
    hi: "पंजीकृत सत्यापन चरण के माध्यम से पहुँच की पुष्टि करें।"
  },
  workflowStep3Title: {
    en: "3. Verify Identity",
    te: "3. గుర్తింపు ధృవీకరణ",
    hi: "3. पहचान सत्यापित करें"
  },
  workflowStep3Desc: {
    en: "Complete the prototype identity verification step.",
    te: "ప్రోటోటైప్ గుర్తింపు ధృవీకరణ దశను పూర్తి చేయండి.",
    hi: "प्रोटोटाइप पहचान सत्यापन चरण पूरा करें।"
  },
  workflowStep4Title: {
    en: "4. View Your Election",
    te: "4. మీ ఎన్నికలు చూడండి",
    hi: "4. अपना चुनाव देखें"
  },
  workflowStep4Desc: {
    en: "Review the active election and candidates for your constituency.",
    te: "మీ నియోజకవర్గానికి సంబంధించిన ఎన్నికలు మరియు అభ్యర్థుల వివరాలను సమీక్షించండి.",
    hi: "अपने निर्वाचन क्षेत्र के लिए सक्रिय चुनाव और उम्मीदवारों की समीक्षा करें।"
  },
  workflowStep5Title: {
    en: "5. Choose Candidate",
    te: "5. అభ్యర్థిని ఎంచుకోండి",
    hi: "5. उम्मीदवार चुनें"
  },
  workflowStep5Desc: {
    en: "Select your preferred candidate on the clean electronic ballot.",
    te: "ఎలక్ట్రానిక్ బ్యాలెట్‌పై మీకు నచ్చిన అభ్యర్థిని ఎంపిక చేయండి.",
    hi: "इलेक्ट्रॉनिक मतपत्र पर अपने पसंदीदा उम्मीदवार का चयन करें।"
  },
  workflowStep6Title: {
    en: "6. Review & Confirm",
    te: "6. సమీక్షించి నిర్ధారించండి",
    hi: "6. समीक्षा और पुष्टि करें"
  },
  workflowStep6Desc: {
    en: "Check your selection carefully before final submission.",
    te: "తుది సమర్పణకు ముందు మీ ఎంపికను జాగ్రత్తగా పరిశీలించండి.",
    hi: "अंतिम रूप से जमा करने से पहले अपने चयन की सावधानीपूर्वक समीक्षा करें।"
  },
  workflowStep7Title: {
    en: "7. Vote Submitted",
    te: "7. ఓటు సమర్పించబడింది",
    hi: "7. वोट जमा किया गया"
  },
  workflowStep7Desc: {
    en: "Your ballot is securely processed and privacy separation is enforced.",
    te: "మీ బ్యాలెట్ సురక్షితంగా నమోదు చేయబడింది మరియు గోప్యతా విభజన అమలు చేయబడింది.",
    hi: "आपका मतपत्र सुरक्षित रूप से संसाधित किया गया है और गोपनीयता पृथक्करण लागू है।"
  },

  // Security Behind the Vote Section
  securitySectionTitle: {
    en: "Security Behind the Vote",
    te: "ఓటు వెనుక ఉన్న భద్రత",
    hi: "वोट के पीछे की सुरक्षा"
  },
  securitySectionSubtitle: {
    en: "Four foundational principles engineered into the prototype.",
    te: "ఈ పరిశోధనా నమూనాలో పొందుపరచబడిన నాలుగు ప్రాథమిక సూత్రాలు.",
    hi: "प्रोटोटाइप में निर्मित चार मूलभूत सुरक्षा सिद्धांत।"
  },
  secVoterVerificationTitle: {
    en: "Voter Verification",
    te: "ఓటరు ధృవీకరణ",
    hi: "मतदाता सत्यापन"
  },
  secVoterVerificationDesc: {
    en: "Only authenticated voters can access the voting process.",
    te: "ధృవీకరించబడిన ఓటర్లు మాత్రమే ఓటింగ్ ప్రక్రియను యాక్సెస్ చేయగలరు.",
    hi: "केवल प्रमाणित मतदाता ही मतदान प्रक्रिया तक पहुँच सकते हैं।"
  },
  secProtectedBallotsTitle: {
    en: "Protected Ballots",
    te: "రక్షిత బ్యాలెట్లు",
    hi: "सुरक्षित मतपत्र"
  },
  secProtectedBallotsDesc: {
    en: "Ballots are authenticated and encrypted before storage.",
    te: "బ్యాలెట్లు నిల్వ చేయడానికి ముందే ప్రామాణీకరించబడి ఎన్‌క్రిప్ట్ చేయబడతాయి.",
    hi: "संग्रहीत करने से पहले मतपत्रों को प्रमाणित और एन्क्रिप्ट किया जाता है।"
  },
  secQkdTitle: {
    en: "Quantum Key Establishment",
    te: "క్వాంటమ్ కీ స్థాపన",
    hi: "क्वांटम कुंजी स्थापना"
  },
  secQkdDesc: {
    en: "BB84 is simulated to establish key material and assess channel disturbance.",
    te: "కీ మెటీరియల్ స్థాపించడానికి మరియు ఛానెల్ అంతరాయాన్ని అంచనా వేయడానికి BB84 అనుకరించబడుతుంది.",
    hi: "कुंजी सामग्री स्थापित करने और चैनल व्यवधान का आकलन करने के लिए BB84 का अनुकरण किया जाता है।"
  },
  secPrivacySeparationTitle: {
    en: "Privacy Separation",
    te: "గోప్యతా విభజన",
    hi: "गोपनीयता पृथक्करण"
  },
  secPrivacySeparationDesc: {
    en: "Participation records are maintained separately from stored ballot data.",
    te: "భాగస్వామ్య రికార్డులు నిల్వ చేసిన బ్యాలెట్ డేటా నుండి పూర్తిగా వేరుగా ఉంచబడతాయి.",
    hi: "भागीदारी रिकॉर्ड को संग्रहीत मतपत्र डेटा से अलग रखा जाता है।"
  },

  // Academic Notice
  syntheticDataNotice: {
    en: "This is an academic research prototype using synthetic/demo voter data. It is not connected to government voter registries.",
    te: "ఇది సింథటిక్/డెమో ఓటరు డేటాను ఉపయోగించే విద్యా పరిశోధనా నమూనా. ఇది ప్రభుత్వ ఓటరు రిజిస్ట్రీలతో అనుసంధానించబడలేదు.",
    hi: "यह कृत्रिम/डेमो मतदाता डेटा का उपयोग करने वाला एक अकादमिक अनुसंधान प्रोटोटाइप है। यह सरकारी मतदाता सूची से संबद्ध नहीं है।"
  },

  // Final CTA Section
  finalCtaStatement: {
    en: "SECURE TECHNOLOGY\nSHOULD FEEL SIMPLE\nTO THE VOTER.",
    te: "సురక్షిత సాంకేతికత\nఓటరుకు సులభంగా\nఅనిపించాలి.",
    hi: "सुरक्षित तकनीक\nमतदाता के लिए सरल\nमहसूस होनी चाहिए।"
  },
  finalCtaHeadline: {
    en: "SECURE TECHNOLOGY\nSHOULD FEEL SIMPLE\nTO THE VOTER.",
    te: "సురక్షిత సాంకేతికత\nఓటరుకు సులభంగా\nఅనిపించాలి.",
    hi: "सुरक्षित तकनीक\nमतदाता के लिए सरल\nमहसूस होनी चाहिए।"
  },
  finalCtaSubtitle: {
    en: "A research prototype combining modern voter verification, protected ballot handling, and simulated quantum key distribution.",
    te: "ఆధునిక ఓటరు ధృవీకరణ, రక్షిత బ్యాలెట్ నిర్వహణ మరియు సిమ్యులేటెడ్ క్వాంటమ్ కీ పంపిణీని మిళితం చేసే పరిశోధనా నమూనా.",
    hi: "आधुनिक मतदाता सत्यापन, सुरक्षित मतपत्र प्रबंधन और सिम्युलेटेड क्वांटम कुंजी वितरण को संयोजित करने वाला एक शोध प्रोटोटाइप।"
  },
  readyToVoteTitle: {
    en: "Explore the system. Understand the process. Cast a vote in the prototype.",
    te: "వ్యవస్థను అన్వేషించండి. ప్రక్రియను అర్థం చేసుకోండి. నమూనాలో ఓటు వేయండి.",
    hi: "प्रणाली का अन्वेषण करें। प्रक्रिया को समझें। प्रोटोटाइप में वोट डालें।"
  },
  readyToVoteDesc: {
    en: "A research prototype combining modern voter verification, protected ballot handling, and simulated quantum key distribution.",
    te: "ఆధునిక ఓటరు ధృవీకరణ, రక్షిత బ్యాలెట్ నిర్వహణ మరియు సిమ్యులేటెడ్ క్వాంటమ్ కీ పంపిణీని మిళితం చేసే పరిశోధనా నమూనా.",
    hi: "आधुनिक मतदाता सत्यापन, सुरक्षित मतपत्र प्रबंधन और सिम्युलेटेड क्वांटम कुंजी वितरण को संयोजित करने वाला एक शोध प्रोटोटाइप।"
  },

  // Voter Balloting
  voterDashboardTitle: {
    en: "Official Electronic Ballot",
    te: "అధికారిక ఎలక్ట్రానిక్ బ్యాలెట్",
    hi: "आधिकारिक इलेक्ट्रॉनिक मतपत्र"
  },
  registeredConstituency: {
    en: "Registered Constituency",
    te: "నమోదిత నియోజకవర్గం",
    hi: "पंजीकृत निर्वाचन क्षेत्र"
  },
  votingEligibility: {
    en: "Voting Status",
    te: "ఓటింగ్ స్థితి",
    hi: "मतदान स्थिति"
  },
  eligibleToVote: {
    en: "Eligible to Vote",
    te: "ఓటు వేయడానికి అర్హులు",
    hi: "मतदान के पात्र"
  },
  alreadyVotedStatus: {
    en: "Vote Already Cast for this Election",
    te: "ఈ ఎన్నికల్లో ఓటు ఇప్పటికే నమోదు చేయబడింది",
    hi: "इस चुनाव के लिए पहले ही वोट डाला जा चुका है"
  },
  selectCandidatePrompt: {
    en: "Select your preferred candidate below, then proceed to review and confirm.",
    te: "దిగువన మీ అభ్యర్థిని ఎంచుకుని, పరిశీలించి నిర్ధారించండి.",
    hi: "नीचे अपने पसंदीदा उम्मीदवार का चयन करें, फिर समीक्षा और पुष्टि करने के लिए आगे बढ़ें।"
  },
  candidateName: {
    en: "Candidate Name",
    te: "అభ్యర్థి పేరు",
    hi: "उम्मीदवार का नाम"
  },
  partyAffiliation: {
    en: "Party Affiliation",
    te: "పార్టీ",
    hi: "राजनीतिक दल"
  },
  reviewAndConfirm: {
    en: "Review & Cast Vote",
    te: "సమీక్షించి ఓటు నమోదు చేయండి",
    hi: "समीक्षा करें और वोट डालें"
  },
  confirmModalTitle: {
    en: "Confirm Your Vote",
    te: "మీ ఓటును నిర్ధారించండి",
    hi: "अपने वोट की पुष्टि करें"
  },
  confirmModalMessage: {
    en: "Selected candidate:",
    te: "ఎంచుకున్న అభ్యర్థి:",
    hi: "चयनित उम्मीदवार:"
  },
  confirmModalNotice: {
    en: "Your vote cannot be changed after submission.",
    te: "సమర్పించిన తర్వాత మీ ఓటును మార్చడం సాధ్యం కాదు.",
    hi: "जमा करने के बाद आपका वोट बदला नहीं जा सकता।"
  },
  confirmVoteBtn: {
    en: "Confirm Vote",
    te: "ఓటును నిర్ధారించండి",
    hi: "वोट की पुष्टि करें"
  },
  cancelBtn: {
    en: "Cancel",
    te: "రద్దు చేయి",
    hi: "रद्द करें"
  },

  // Success Screen
  voteSuccessTitle: {
    en: "Vote Submitted Successfully",
    te: "ఓటు విజయవంతంగా సమర్పించబడింది",
    hi: "वोट सफलतापूर्वक जमा हुआ"
  },
  voteSuccessMessage: {
    en: "Your vote has been securely recorded.",
    te: "మీ ఓటు సురక్షితంగా నమోదైంది.",
    hi: "आपका वोट सुरक्षित रूप से दर्ज कर लिया गया है।"
  },
  thankYouForParticipating: {
    en: "Thank you for participating.",
    te: "ఓటింగ్‌లో పాల్గొన్నందుకు ధన్యవాదాలు.",
    hi: "भागीदारी के लिए धन्यवाद।"
  },
  returnToDashboard: {
    en: "Return to Dashboard",
    te: "డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళండి",
    hi: "डैशबोर्ड पर वापस लौटें"
  },
  secureVotingPortal: {
    en: "Secure Voting Portal",
    te: "సురక్షిత ఓటింగ్ పోర్టల్",
    hi: "सुरक्षित मतदान पोर्टल"
  },
  securePortalAria: {
    en: "Official Secure Electronic Voting Portal",
    te: "అధికారిక సురక్షిత ఎలక్ట్రానిక్ ఓటింగ్ పోర్టల్",
    hi: "आधिकारिक सुरक्षित इलेक्ट्रॉनिक मतदान पोर्टल"
  },
  digitalBallotingUnit: {
    en: "Digital Balloting Unit",
    te: "డిజిటల్ బ్యాలెట్ యూనిట్",
    hi: "डिजिटल मतपत्र इकाई"
  },
  unitReady: {
    en: "UNIT READY",
    te: "యూనిట్ సిద్ధంగా ఉంది",
    hi: "इकाई तैयार है"
  },
  districtLabel: {
    en: "District",
    te: "జిల్లా",
    hi: "जिला"
  },
  stateLabel: {
    en: "State",
    te: "రాష్ట్రం",
    hi: "राज्य"
  },
  serialNoLabel: {
    en: "S.No.",
    te: "వరుస సంఖ్య",
    hi: "क्रम संख्या"
  },
  notaBadge: {
    en: "NOTA",
    te: "నోటా",
    hi: "नोटा"
  },
  selectedAria: {
    en: "Selected",
    te: "ఎంపిక చేయబడింది",
    hi: "चयनित"
  },
  unselectedAria: {
    en: "Unselected",
    te: "ఎంపిక చేయలేదు",
    hi: "अचयनित"
  },
  candidateDetailsAria: {
    en: "Candidate Details",
    te: "అభ్యర్థి వివరాలు",
    hi: "उम्मीदवार विवरण"
  },
  audioSelectPrompt: {
    en: "Select one candidate from your constituency.",
    te: "మీ నియోజకవర్గం నుండి ఒక అభ్యర్థిని ఎంచుకోండి.",
    hi: "अपने निर्वाचन क्षेत्र से एक उम्मीदवार चुनें।"
  },
  qberMetric: {
    en: "Quantum Bit Error Rate (QBER)",
    te: "క్వాంటమ్ బిట్ ఎర్రర్ రేట్ (QBER)",
    hi: "क्वांटम बिट एरर रेट (QBER)"
  },
  channelSecure: {
    en: "Quantum Simulation: Secure & Within Threshold (<= 11%)",
    te: "క్వాంటమ్ సిమ్యులేషన్: సురక్షితం మరియు పరిమితి లోపు (<= 11%)",
    hi: "क्वांटम सिमुलेशन: सुरक्षित एवं सीमा के भीतर (<= 11%)"
  },
  returnHome: {
    en: "Return to Home",
    te: "హోమ్ కి వెళ్ళండి",
    hi: "होम पर लौटें"
  },

  // Admin Terms
  adminDashboard: {
    en: "Election Commission Admin Dashboard",
    te: "ఎన్నికల సంఘం అడ్మిన్ డాష్‌బోర్డ్",
    hi: "चुनाव आयोग व्यवस्थापक डैशबोर्ड"
  },
  voterManagement: {
    en: "Voter Management",
    te: "ఓటరు నిర్వహణ",
    hi: "मतदाता प्रबंधन"
  },
  electionManagement: {
    en: "Election Management",
    te: "ఎన్నికల నిర్వహణ",
    hi: "चुनाव प्रबंधन"
  },
  candidateManagement: {
    en: "Candidate Management",
    te: "అభ్యర్థుల నిర్వహణ",
    hi: "उम्मीदवार प्रबंधन"
  },
  auditLogViewer: {
    en: "Audit Log Viewer",
    te: "ఆడిట్ లాగ్ వీక్షకుడు",
    hi: "ऑडिट लॉग व्यूअर"
  },
  quantumLab: {
    en: "Quantum Simulation Lab",
    te: "క్వాంటమ్ సిమ్యులేషన్ ల్యాబ్",
    hi: "क्वांटम सिमुलेशन लैब"
  },

  // Voter Flow & Accessibility
  loadingVoterInfo: {
    en: "Loading voter information...",
    te: "ఓటరు వివరాలు లోడ్ అవుతున్నాయి...",
    hi: "मतदाता विवरण लोड हो रहा है..."
  },
  loadingBallot: {
    en: "Loading ballot candidates...",
    te: "బ్యాలెట్ అభ్యర్థుల వివరాలు లోడ్ అవుతున్నాయి...",
    hi: "उम्मीदवार विवरण लोड हो रहा है..."
  },
  noActiveElection: {
    en: "No Active Election",
    te: "ఎన్నికలు అందుబాటులో లేవు",
    hi: "कोई सक्रिय चुनाव नहीं है"
  },
  noActiveElectionDesc: {
    en: "No civic elections are currently scheduled or running.",
    te: "ప్రస్తుతం ఎటువంటి ఎన్నికలు చురుకుగా లేవు.",
    hi: "वर्तमान में कोई नागरिक चुनाव निर्धारित या सक्रिय नहीं है।"
  },
  electionInactiveStatus: {
    en: "Election Inactive / Not Open",
    te: "ఎన్నికలు ప్రారంభం కాలేదు",
    hi: "चुनाव निष्क्रिय / खुला नहीं है"
  },
  votingClosed: {
    en: "Voting is currently closed",
    te: "ఓటింగ్ ప్రస్తుతం అందుబాటులో లేదు",
    hi: "मतदान वर्तमान में बंद है"
  },
  proceedToBallot: {
    en: "Proceed to Electronic Ballot",
    te: "బ్యాలెట్ పత్రానికి వెళ్లండి",
    hi: "इलेक्ट्रॉनिक मतपत्र पर आगे बढ़ें"
  },
  backToDashboard: {
    en: "Back to Dashboard",
    te: "డాష్‌బోర్డ్‌కు తిరిగి వెళ్ళండి",
    hi: "डैशबोर्ड पर वापस लौटें"
  },
  readOutDetails: {
    en: "Read Out",
    te: "వినండి",
    hi: "सुनाएं"
  },
  hearCandidateDetails: {
    en: "Hear candidate details",
    te: "అభ్యర్థి వివరాలను వినండి",
    hi: "उम्मीदवार का विवरण सुनें"
  },
  listenStatus: {
    en: "Listen Status",
    te: "స్థితిని వినండి",
    hi: "स्थिति सुनें"
  },
  processingSecureVote: {
    en: "Submitting your vote securely...",
    te: "మీ ఓటు సురక్షితంగా సమర్పించబడుతోంది...",
    hi: "आपका वोट सुरक्षित रूप से जमा किया जा रहा है..."
  },
  votingNotice: {
    en: "Voting Notice",
    te: "ఓటింగ్ గమనిక",
    hi: "मतदान सूचना"
  },
  candidateSelectionClearedNotice: {
    en: "To protect your voting privacy, candidate details are not displayed after submission.",
    te: "మీ ఓటు గోప్యతను కాపాడటానికి, ఓటు వేసిన తర్వాత అభ్యర్థి వివరాలు ప్రదర్శించబడవు.",
    hi: "आपकी मतदान गोपनीयता की सुरक्षा के लिए, वोट जमा करने के बाद उम्मीदवार का विवरण प्रदर्शित नहीं किया जाता है।"
  },
  voteSuccessSpoken: {
    en: "Vote submitted successfully. Your vote has been securely recorded. Thank you for participating.",
    te: "ఓటు విజయవంతంగా సమర్పించబడింది. మీ ఓటు సురక్షితంగా నమోదైంది. ఓటింగ్‌లో పాల్గొన్నందుకు ధన్యవాదాలు.",
    hi: "वोट सफलतापूर्वक जमा हुआ। आपका वोट सुरक्षित रूप से दर्ज कर लिया गया है। भागीदारी के लिए धन्यवाद।"
  },
  qberDisturbanceError: {
    en: "The secure voting connection could not be established due to network disturbance. Your vote was not submitted. Please try again.",
    te: "నెట్‌వర్క్ అంతరాయం కారణంగా సురక్షిత ఓటింగ్ అనుసంధానం ఏర్పాటు కాలేదు. మీ ఓటు సమర్పించబడలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.",
    hi: "नेटवर्क व्यवधान के कारण सुरक्षित मतदान कनेक्शन स्थापित नहीं हो सका। आपका वोट जमा नहीं हुआ। कृपया पुनः प्रयास करें।"
  },
  sessionExpiredError: {
    en: "Your session has expired. Please log in again.",
    te: "మీ సెషన్ గడువు ముగిసింది. దయచేసి మళ్లీ లాగిన్ అవ్వండి.",
    hi: "आपका सत्र समाप्त हो गया है। कृपया पुनः लॉगिन करें।"
  },
  unauthorizedError: {
    en: "You are not authorized to vote in this election.",
    te: "ఈ ఎన్నికల్లో ఓటు వేయడానికి మీకు అనుమతి లేదు.",
    hi: "आप इस चुनाव में मतदान करने के लिए अधिकृत नहीं हैं।"
  },
  duplicateVoteError: {
    en: "This election vote has already been submitted.",
    te: "ఈ ఎన్నికకు ఓటు ఇప్పటికే సమర్పించబడింది.",
    hi: "इस चुनाव के लिए वोट पहले ही जमा किया जा चुका है।"
  },
  generalVoteError: {
    en: "Your vote could not be processed. Please try again.",
    te: "మీ ఓటు ప్రాసెస్ కాలేదు. దయచేసి మళ్లీ ప్రయత్నించండి.",
    hi: "आपका वोट संसाधित नहीं किया जा सका। कृपया पुनः प्रयास करें।"
  },
  serverVoteError: {
    en: "Server error processing your vote. Please try again later.",
    te: "మీ ఓటును ప్రాసెస్ చేయడంలో సర్వర్ లోపం ఏర్పడింది. దయచేసి కాసేపటి తర్వాత మళ్లీ ప్రయత్నించండి.",
    hi: "आपके वोट को संसाधित करने में सर्वर त्रुटि हुई। कृपया बाद में पुनः प्रयास करें।"
  },
  noCandidatesAvailable: {
    en: "No Candidates Available",
    te: "అభ్యర్థులు ఎవరూ అందుబాటులో లేరు",
    hi: "कोई उम्मीदवार उपलब्ध नहीं है"
  },
  noCandidatesInConstituency: {
    en: "No candidates have been registered for your constituency",
    te: "మీ నియోజకవర్గానికి అభ్యర్థులెవరూ నమోదు కాలేదు",
    hi: "आपके निर्वाचन क्षेत्र के लिए कोई उम्मीदवार पंजीकृत नहीं है"
  },
  singleVoteEnforcedNotice: {
    en: "Your vote has been cast. The one-vote-per-election policy is enforced.",
    te: "మీ ఓటు విజయవంతంగా రక్షించబడింది. ఒకే ఓటు నిబంధన అమలులో ఉంది.",
    hi: "आपका वोट डाल दिया गया है। प्रति चुनाव एक वोट की नीति लागू है।"
  },
  recordedAt: {
    en: "Recorded at: ",
    te: "నమోదైన సమయం: ",
    hi: "दर्ज होने का समय: "
  },
  confirmDetailsAudio: {
    en: "Hear confirmation details",
    te: "నిర్ధారణ వివరాలు వినండి",
    hi: "पुष्टि विवरण सुनें"
  },
  authenticatedVoter: {
    en: "Authenticated Voter",
    te: "ధృవీకరించబడిన ఓటరు",
    hi: "सत्यापित मतदाता"
  },
  welcomeUser: {
    en: "Welcome, ",
    te: "స్వాగతం, ",
    hi: "स्वागत है, "
  },
  activeCivicElection: {
    en: "Active Civic Election",
    te: "ప్రస్తుత పౌర ఎన్నికలు",
    hi: "सक्रिय नागरिक चुनाव"
  },
  electoralProcess: {
    en: "Institutional Electoral Process",
    te: "సంస్థాగత ఎన్నికల ప్రక్రియ",
    hi: "संस्थागत चुनावी प्रक्रिया"
  },
  verifiedParticipation: {
    en: "Verified in participation record",
    te: "భాగస్వామ్య రికార్డులో ధృవీకరించబడింది",
    hi: "भागीदारी रिकॉर्ड में सत्यापित"
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language') as Language;
    return saved === 'te' || saved === 'hi' || saved === 'en' ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within LanguageProvider');
  return context;
};
