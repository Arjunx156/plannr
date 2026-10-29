/**
 * Words on the pages guests open: the RSVP and the event website. Hosts plan in English;
 * their guests can read these in the family's language. Function names and the family's
 * own text stay as the family wrote them.
 */

export type GuestLang = "en" | "ml" | "hi" | "ta";

export const LANG_NAME: Record<GuestLang, string> = {
  en: "English",
  ml: "മലയാളം",
  hi: "हिन्दी",
  ta: "தமிழ்",
};

export function guestLang(code: string | undefined): GuestLang | undefined {
  return code === "ml" || code === "hi" || code === "ta" || code === "en" ? code : undefined;
}

const en = {
  invited: "You're invited",
  namaste: "Namaste, {name}.",
  invitedTo: "You're invited to {n}. Tell us who's coming.",
  oneFunction: "1 function",
  functions: "{n} functions",
  going: "Going",
  cant: "Can't come",
  howMany: "How many of you?",
  meal: "Meal",
  veg: "Vegetarian",
  nonveg: "Non-veg",
  jain: "Jain",
  room: "Need a room nearby?",
  pickup: "Need a pickup from the airport or station?",
  pickupHint: "Where and when you arrive",
  note: "A note for the family",
  notePlaceholder: "Allergies, a wheelchair, anything we should know",
  send: "Send RSVP",
  sending: "Sending…",
  thanks: "Thank you! The family has your answer.",
  change: "Change my answer",
  calendar: "Add to calendar",
  entry: "Show this at the entrance for a quick welcome.",
  map: "Map",
  dress: "Dress",
  schedule: "Schedule",
  questions: "Questions",
  updates: "Updates",
  story: "Our story",
  answerAll: "Answer for each function above.",
  rsvpNote: "Your RSVP link is in the invitation the family sent you.",
};

export type GuestText = typeof en;

const ml: GuestText = {
  invited: "നിങ്ങളെ ക്ഷണിക്കുന്നു",
  namaste: "നമസ്കാരം, {name}.",
  invitedTo: "{n} നിങ്ങളെ ക്ഷണിക്കുന്നു. ആരൊക്കെ വരുമെന്ന് അറിയിക്കൂ.",
  oneFunction: "ഒരു ചടങ്ങിലേക്ക്",
  functions: "{n} ചടങ്ങുകളിലേക്ക്",
  going: "വരും",
  cant: "വരാൻ കഴിയില്ല",
  howMany: "എത്ര പേർ?",
  meal: "ഭക്ഷണം",
  veg: "വെജിറ്റേറിയൻ",
  nonveg: "നോൺ-വെജ്",
  jain: "ജൈൻ",
  room: "അടുത്ത് താമസസൗകര്യം വേണോ?",
  pickup: "വിമാനത്താവളത്തിൽ നിന്നോ സ്റ്റേഷനിൽ നിന്നോ കൂട്ടിക്കൊണ്ടുവരണോ?",
  pickupHint: "എവിടെ, എപ്പോൾ എത്തും",
  note: "കുടുംബത്തിനുള്ള കുറിപ്പ്",
  notePlaceholder: "അലർജി, വീൽചെയർ, ഞങ്ങൾ അറിയേണ്ട എന്തും",
  send: "മറുപടി അയയ്ക്കൂ",
  sending: "അയയ്ക്കുന്നു…",
  thanks: "നന്ദി! നിങ്ങളുടെ മറുപടി കുടുംബത്തിന് ലഭിച്ചു.",
  change: "മറുപടി മാറ്റുക",
  calendar: "കലണ്ടറിൽ ചേർക്കുക",
  entry: "പ്രവേശന കവാടത്തിൽ ഇത് കാണിക്കുക.",
  map: "മാപ്പ്",
  dress: "വസ്ത്രധാരണം",
  schedule: "പരിപാടികൾ",
  questions: "ചോദ്യങ്ങൾ",
  updates: "അറിയിപ്പുകൾ",
  story: "ഞങ്ങളുടെ കഥ",
  answerAll: "ഓരോ ചടങ്ങിനും മറുപടി നൽകൂ.",
  rsvpNote: "മറുപടി അയയ്ക്കാനുള്ള ലിങ്ക് കുടുംബം അയച്ച ക്ഷണത്തിലുണ്ട്.",
};

const hi: GuestText = {
  invited: "आप आमंत्रित हैं",
  namaste: "नमस्ते, {name}।",
  invitedTo: "आपको {n} में आमंत्रित किया गया है। बताइए कौन आ रहा है।",
  oneFunction: "1 कार्यक्रम",
  functions: "{n} कार्यक्रमों",
  going: "आएँगे",
  cant: "नहीं आ पाएँगे",
  howMany: "कितने लोग?",
  meal: "भोजन",
  veg: "शाकाहारी",
  nonveg: "मांसाहारी",
  jain: "जैन",
  room: "पास में कमरा चाहिए?",
  pickup: "एयरपोर्ट या स्टेशन से लेने आएँ?",
  pickupHint: "कहाँ और कब पहुँचेंगे",
  note: "परिवार के लिए संदेश",
  notePlaceholder: "एलर्जी, व्हीलचेयर, कुछ भी जो हमें पता होना चाहिए",
  send: "जवाब भेजें",
  sending: "भेज रहे हैं…",
  thanks: "धन्यवाद! परिवार को आपका जवाब मिल गया है।",
  change: "जवाब बदलें",
  calendar: "कैलेंडर में जोड़ें",
  entry: "प्रवेश द्वार पर यह दिखाएँ।",
  map: "नक्शा",
  dress: "पहनावा",
  schedule: "कार्यक्रम",
  questions: "सवाल-जवाब",
  updates: "सूचनाएँ",
  story: "हमारी कहानी",
  answerAll: "ऊपर हर कार्यक्रम के लिए जवाब दें।",
  rsvpNote: "जवाब देने का लिंक परिवार के भेजे निमंत्रण में है।",
};

const ta: GuestText = {
  invited: "உங்களை அன்புடன் அழைக்கிறோம்",
  namaste: "வணக்கம், {name}.",
  invitedTo: "{n} உங்களை அழைக்கிறோம். யார் வருகிறார்கள் என்று தெரிவியுங்கள்.",
  oneFunction: "ஒரு நிகழ்ச்சிக்கு",
  functions: "{n} நிகழ்ச்சிகளுக்கு",
  going: "வருகிறோம்",
  cant: "வர இயலாது",
  howMany: "எத்தனை பேர்?",
  meal: "உணவு",
  veg: "சைவம்",
  nonveg: "அசைவம்",
  jain: "ஜைன",
  room: "அருகில் தங்குமிடம் வேண்டுமா?",
  pickup: "விமான நிலையம் அல்லது ரயில் நிலையத்திலிருந்து அழைத்து வர வேண்டுமா?",
  pickupHint: "எங்கே, எப்போது வருகிறீர்கள்",
  note: "குடும்பத்தினருக்கு ஒரு குறிப்பு",
  notePlaceholder: "ஒவ்வாமை, சக்கர நாற்காலி, நாங்கள் அறிய வேண்டியவை",
  send: "பதில் அனுப்பு",
  sending: "அனுப்புகிறது…",
  thanks: "நன்றி! உங்கள் பதில் குடும்பத்தினருக்குக் கிடைத்தது.",
  change: "பதிலை மாற்று",
  calendar: "நாட்காட்டியில் சேர்",
  entry: "நுழைவாயிலில் இதைக் காட்டுங்கள்.",
  map: "வரைபடம்",
  dress: "உடை",
  schedule: "நிகழ்ச்சி நிரல்",
  questions: "கேள்விகள்",
  updates: "அறிவிப்புகள்",
  story: "எங்கள் கதை",
  answerAll: "மேலே ஒவ்வொரு நிகழ்ச்சிக்கும் பதில் அளியுங்கள்.",
  rsvpNote: "பதில் அனுப்பும் இணைப்பு குடும்பத்தினர் அனுப்பிய அழைப்பில் உள்ளது.",
};

const TEXT: Record<GuestLang, GuestText> = { en, ml, hi, ta };

export function guestText(lang: GuestLang): GuestText {
  return TEXT[lang];
}

/** Fills "{name}"-style slots. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
}
