import type { Language } from '../context/LanguageContext';
import type { Candidate, Constituency, Election } from '../services/api';

/**
 * Deterministic fallback translations for synthetic demo candidates,
 * ensuring proper names and parties are localized cleanly without runtime machine translation.
 */
const CANDIDATE_NAMES_MAP: Record<string, { te: string; hi: string }> = {
  'Ananya Rao': { te: 'అనన్య రావు', hi: 'अनन्या राव' },
  'Ravi Kumar': { te: 'రవి కుమార్', hi: 'रवि कुमार' },
  'Meera Das': { te: 'మీరా దాస్', hi: 'मीरा दास' },
  'Dr. Sarah Rao': { te: 'డాక్టర్ సారా రావు', hi: 'डॉ. सारा राव' },
  'K. Venkatesh': { te: 'కె. వెంకటేష్', hi: 'के. वेंकटेश' },
  'A. Narayan': { te: 'ఎ. నారాయణ్', hi: 'ए. नारायण' },
  'P. Sundaram': { te: 'పి. సుందరం', hi: 'पी. सुंदरम' },
  'M. Lakshmi': { te: 'ఎం. లక్ష్మి', hi: 'एम. लक्ष्मी' },
  'R. Kulkarni': { te: 'ఆర్. కులకర్ణి', hi: 'आर. कुलकर्णी' },
  'Arjun Patel': { te: 'అర్జున్ పటేల్', hi: 'अर्जुन पटेल' },
  'Kavya Singh': { te: 'కావ్య సింగ్', hi: 'काव्या सिंह' },
  'Suresh Nair': { te: 'సురేష్ నాయర్', hi: 'सुरेश नायर' },
  'Priya Sharma': { te: 'ప్రియా శర్మ', hi: 'प्रिया शर्मा' },
  'Vikram Reddy': { te: 'విక్రమ్ రెడ్డి', hi: 'विक्रम रेड्डी' },
  'Neha Joseph': { te: 'నేహా జోసెఫ్', hi: 'नेहा जोसेफ' },
  'Himesh': { te: 'హిమేష్', hi: 'हिमेश' },
  'KA Paul': { te: 'కె.ఎ. పాల్', hi: 'के.ए. पॉल' },
  'Alice Sharma': { te: 'అలిస్ శర్మ', hi: 'एलिस शर्मा' },
  'Bob Verma': { te: 'బాబ్ వర్మ', hi: 'बॉब वर्मा' },
  'Charlie Patel': { te: 'చార్లీ పటేల్', hi: 'चार्ली पटेल' }
};

const PARTIES_MAP: Record<string, { te: string; hi: string }> = {
  'TDP / NDA Alliance': { te: 'తెలుగు దేశం / ఎన్డీఏ కూటమి', hi: 'तेलुगु देशम / एनडीए गठबंधन' },
  'TDP': { te: 'తెలుగు దేశం పార్టీ', hi: 'तेलुगु देशम पार्टी' },
  'YSRCP': { te: 'వైఎస్సార్‌సీపీ', hi: 'वाईएसआरसीपी' },
  'INC': { te: 'భారత జాతీయ కాంగ్రెస్ (INC)', hi: 'भारतीय राष्ट्रीय कांग्रेस (INC)' },
  'Congress': { te: 'కాంగ్రెస్', hi: 'कांग्रेस' },
  'Janasena Party / NDA Alliance': { te: 'జనసేన పార్టీ / ఎన్డీఏ కూటమి', hi: 'जनसेना पार्टी / एनडीए गठबंधन' },
  'Janasena': { te: 'జనసేన పార్టీ', hi: 'जनसेना पार्टी' },
  'BJP / NDA Alliance': { te: 'భారతీయ జనతా పార్టీ / ఎన్డీఏ కూటమి', hi: 'भारतीय जनता पार्टी / एनडीए गठबंधन' },
  'BJP': { te: 'భారతీయ జనతా పార్టీ', hi: 'भारतीय जनता पार्टी' },
  'CPI(M)': { te: 'సీపీఐ(ఎం)', hi: 'सीपीएम' },
  'CPI': { te: 'సీపీఐ', hi: 'सीपीआई' },
  "People's Party": { te: 'పీపుల్స్ పార్టీ', hi: 'पीपुल्स पार्टी' },
  "People’s Party": { te: 'పీపుల్స్ పార్టీ', hi: 'पीपुल्स पार्टी' },
  'National Party': { te: 'నేషనల్ పార్టీ', hi: 'नेशनल पार्टी' },
  'Independent': { te: 'స్వతంత్ర అభ్యర్థి', hi: 'स्वतंत्र उम्मीदवार' },
  'Progressive Coalition': { te: 'ప్రోగ్రెసివ్ కూటమి', hi: 'प्रगतिशील गठबंधन' },
  'Democratic Alliance': { te: 'డెమోక్రటిక్ అలయన్స్', hi: 'डेमोक्रेटिक अलायंस' },
  'National Front': { te: 'నేషనల్ ఫ్రంట్', hi: 'नेशनल फ्रंट' },
  'Green Future Movement': { te: 'గ్రీన్ ఫ్యూచర్ ఉద్యమం', hi: 'ग्रीन फ्यूचर मूवमेंट' },
  'Civic Union': { te: 'సివిక్ యూనియన్', hi: 'सिविक यूनियन' },
  "United People's Party": { te: 'యునైటెడ్ పీపుల్స్ పార్టీ', hi: 'यूनाइटेड पीपुल्स पार्टी' },
  'NOTA': { te: 'నోటా', hi: 'नोटा' },
  'JJ': { te: 'జేజే', hi: 'जेजे' },
  'MKL': { te: 'ఎంకేఎల్', hi: 'एमकेएल' }
};

const CONSTITUENCIES_MAP: Record<string, { te: string; hi: string }> = {
  // Vizianagaram District
  'Kurupam (ST)': { te: 'కురుపాం (ఎస్టీ)', hi: 'कुरुपाम (एसटी)' },
  'AP-010': { te: 'కురుపాం (ఎస్టీ)', hi: 'कुरुपाम (एसटी)' },
  'Parvathipuram (SC)': { te: 'పార్వతీపురం (ఎస్సీ)', hi: 'पार्वतीपुरम (एससी)' },
  'AP-011': { te: 'పార్వతీపురం (ఎస్సీ)', hi: 'पार्वतीपुरम (एससी)' },
  'Salur (ST)': { te: 'సాలూరు (ఎస్టీ)', hi: 'सालूर (एसटी)' },
  'AP-012': { te: 'సాలూరు (ఎస్టీ)', hi: 'सालूर (एसटी)' },
  'Bobbili': { te: 'బొబ్బిలి', hi: 'बोब्बिली' },
  'AP-013': { te: 'బొబ్బిలి', hi: 'बोब्बिली' },
  'Cheepurupalli': { te: 'చీపురుపల్లి', hi: 'चीपुरुपल्ली' },
  'AP-014': { te: 'చీపురుపల్లి', hi: 'चीपुरुपल्ली' },
  'Gajapathinagaram': { te: 'గజపతినగరం', hi: 'गजपतिनगरम' },
  'AP-015': { te: 'గజపతినగరం', hi: 'गजपतिनगरम' },
  'Nellimarla': { te: 'నెల్లిమర్ల', hi: 'नेल्लिमर्ला' },
  'AP-016': { te: 'నెల్లిమర్ల', hi: 'नेल्लिमर्ला' },
  'Vizianagaram': { te: 'విజయనగరం', hi: 'विजयनगरम' },
  'AP-017': { te: 'విజయనగరం', hi: 'विजयनगरम' },
  'Srungavarapukota': { te: 'శృంగవరపుకోట', hi: 'शृंगवरपुकोटा' },
  'AP-018': { te: 'శృంగవరపుకోట', hi: 'शृंगवरपुकोटा' },

  // Visakhapatnam District
  'Bhimili': { te: 'భీమిలి', hi: 'भीमिली' },
  'AP-019': { te: 'భీమిలి', hi: 'भीमिली' },
  'Visakhapatnam South': { te: 'విశాఖపట్నం దక్షిణ', hi: 'विशाखापट्टनम दक्षिण' },
  'AP-020': { te: 'విశాఖపట్నం దక్షిణ', hi: 'विशाखापट्टनम दक्षिण' },
  'Visakhapatnam North': { te: 'విశాఖపట్నం ఉత్తర', hi: 'विशाखापट्टनम उत्तर' },
  'AP-022': { te: 'విశాఖపట్నం ఉత్తర', hi: 'विशाखापट्टनम उत्तर' },
  'Visakhapatnam West': { te: 'విశాఖపట్నం పశ్చిమ', hi: 'विशाखापट्टनम पश्चिम' },
  'AP-023': { te: 'విశాఖపట్నం పశ్చిమ', hi: 'विशाखापट्टनम पश्चिम' },
  'Gajuwaka': { te: 'గాజువాక', hi: 'गाजुवाका' },
  'AP-024': { te: 'గాజువాక', hi: 'गाजुवाका' },
  'Chodavaram': { te: 'చోడవరం', hi: 'चोडवरम' },
  'AP-025': { te: 'చోడవరం', hi: 'चोडवरम' },
  'Madugula': { te: 'మాడుగుల', hi: 'माडुगुला' },
  'AP-026': { te: 'మాడుగుల', hi: 'माडुगुला' },
  'Araku Valley (ST)': { te: 'అరకు లోయ (ఎస్టీ)', hi: 'अराकु घाटी (एसटी)' },
  'AP-027': { te: 'అరకు లోయ (ఎస్టీ)', hi: 'अराकु घाटी (एसटी)' },
  'Paderu (ST)': { te: 'పాడేరు (ఎస్టీ)', hi: 'पाडेरु (एसटी)' },
  'AP-028': { te: 'పాడేరు (ఎస్టీ)', hi: 'पाडेरु (एसटी)' },
  'Anakapalle': { te: 'అనకాపల్లి', hi: 'अनकापल्ली' },
  'AP-029': { te: 'అనకాపల్లి', hi: 'अनकापल्ली' },
  'Pendurthi': { te: 'పెందుర్తి', hi: 'पेंदुर्ति' },
  'AP-030': { te: 'పెందుర్తి', hi: 'पेंदुर्ति' },
  'Yelamanchili': { te: 'ఎలమంచిలి', hi: 'यलमंचिली' },
  'AP-031': { te: 'ఎలమంచిలి', hi: 'यलमंचिली' },
  'Payakaraopet (SC)': { te: 'పాయకరావుపేట (ఎస్సీ)', hi: 'पायकारावपेटा (एससी)' },
  'AP-032': { te: 'పాయకరావుపేట (ఎస్సీ)', hi: 'पायकारावपेटा (एससी)' },
  'Narsipatnam': { te: 'నర్సీపట్నం', hi: 'नरसीपटनम' },
  'AP-033': { te: 'నర్సీపట్నం', hi: 'नरसीपटनम' },

  'Mangalagiri': { te: 'మంగళగిరి', hi: 'मंगलगिरि' },
  'AP-087': { te: 'మంగళగిరి', hi: 'मंगलगिरि' },
  'Vijayawada Central': { te: 'విజయవాడ సెంట్రల్', hi: 'विजयवाड़ा मध्य' },
  'AP-080': { te: 'విజయవాడ సెంట్రల్', hi: 'विजयवाड़ा मध्य' },
  'Vijayawada West': { te: 'విజయవాడ పశ్చిమ', hi: 'विजयवाड़ा पश्चिम' },
  'AP-079': { te: 'విజయవాడ పశ్చిమ', hi: 'विजयवाड़ा पश्चिम' },
  'Guntur West': { te: 'గుంటూరు పశ్చిమ', hi: 'गुंटूर पश्चिम' },
  'AP-088': { te: 'గుంటూరు పశ్చిమ', hi: 'गुंटूर पश्चिम' },
  'Visakhapatnam East': { te: 'విశాఖపట్నం తూర్పు', hi: 'विशाखापट्टनम पूर्व' },
  'AP-021': { te: 'విశాఖపట్నం తూర్పు', hi: 'विशाखापट्टनम पूर्व' },
  'Tirupati': { te: 'తిరుపతి', hi: 'तिरुपति' },
  'AP-168': { te: 'తిరుపతి', hi: 'तिरुपति' },
  'Ward-1': { te: 'వార్డు-1', hi: 'वार्ड-1' },
  'W1': { te: 'వార్డు-1', hi: 'वार्ड-1' },
  'Ward-2': { te: 'వార్డు-2', hi: 'वार्ड-2' },
  'W2': { te: 'వార్డు-2', hi: 'वार्ड-2' },
  'Ward-3': { te: 'వార్డు-3', hi: 'वार्ड-3' },
  'W3': { te: 'వార్డు-3', hi: 'वार्ड-3' },
  'HEADQUARTERS': { te: 'ప్రధాన కార్యాలయం', hi: 'मुख्यालय' }
};

const ELECTIONS_MAP: Record<string, { te: string; hi: string }> = {
  'General Assembly Election 2026': {
    te: 'సార్వత్రిక శాసనసభ ఎన్నికలు 2026',
    hi: 'आम विधानसभा चुनाव 2026'
  },
  'Constituency-segregated legislative assembly election with quantum-simulated ballot security.': {
    te: 'క్వాంటమ్-రక్షిత బ్యాలెట్ భద్రతతో నియోజకవర్గాల వారీగా శాసనసభ ఎన్నికలు.',
    hi: 'क्वांटम-सुरक्षित मतपत्र सुरक्षा के साथ निर्वाचन क्षेत्र-वार विधानसभा चुनाव।'
  },
  'State Legislative Assembly': {
    te: 'రాష్ట్ర శాసనసభ',
    hi: 'राज्य विधान सभा'
  }
};

/**
 * Returns the localized candidate display name based on the selected language.
 * Localizes NOTA strictly according to Section 8 specifications.
 */
export function getLocalizedCandidateName(cand: Candidate, language: Language): string {
  if (cand.is_nota) {
    if (language === 'te') return 'పై వారిలో ఎవరూ కాదు (NOTA)';
    if (language === 'hi') return 'इनमें से कोई नहीं (NOTA)';
    return 'None of the Above (NOTA)';
  }

  if (language === 'te') {
    return cand.name_te || CANDIDATE_NAMES_MAP[cand.name]?.te || cand.name;
  }
  if (language === 'hi') {
    return cand.name_hi || CANDIDATE_NAMES_MAP[cand.name]?.hi || cand.name;
  }
  return cand.name_en || cand.name;
}

/**
 * Returns the localized candidate party name based on the selected language.
 */
export function getLocalizedCandidateParty(cand: Candidate, language: Language): string {
  if (cand.is_nota) {
    if (language === 'te') return 'నోటా';
    if (language === 'hi') return 'नोटा';
    return 'NOTA';
  }

  if (language === 'te') {
    return cand.party_te || PARTIES_MAP[cand.party]?.te || cand.party;
  }
  if (language === 'hi') {
    return cand.party_hi || PARTIES_MAP[cand.party]?.hi || cand.party;
  }
  return cand.party_en || cand.party;
}

/**
 * Returns the localized constituency display name.
 * The underlying code/identifier remains authoritative.
 */
export function getLocalizedConstituency(
  constituencyName: string | null | undefined,
  language: Language,
  constituencyObj?: Partial<Constituency>
): string {
  if (!constituencyName) return '';

  if (constituencyObj) {
    if (language === 'te' && constituencyObj.name_te) return constituencyObj.name_te;
    if (language === 'hi' && constituencyObj.name_hi) return constituencyObj.name_hi;
    if (language === 'en' && constituencyObj.name_en) return constituencyObj.name_en;
  }

  const trimmed = constituencyName.trim();
  if (language === 'te') {
    return CONSTITUENCIES_MAP[trimmed]?.te || trimmed;
  }
  if (language === 'hi') {
    return CONSTITUENCIES_MAP[trimmed]?.hi || trimmed;
  }
  return trimmed;
}

/**
 * Returns the localized election title based on the selected language.
 */
export function getLocalizedElectionTitle(
  election: Election | null | undefined,
  language: Language,
  fallback = 'Constituency General Election'
): string {
  if (!election) return fallback;

  if (language === 'te') {
    return election.title_te || ELECTIONS_MAP[election.title]?.te || election.title || fallback;
  }
  if (language === 'hi') {
    return election.title_hi || ELECTIONS_MAP[election.title]?.hi || election.title || fallback;
  }
  return election.title_en || election.title || fallback;
}

/**
 * Returns the localized election description based on the selected language.
 */
export function getLocalizedElectionDesc(
  election: Election | null | undefined,
  language: Language,
  fallback = ''
): string {
  if (!election || !election.description) return fallback;

  if (language === 'te') {
    return election.description_te || ELECTIONS_MAP[election.description]?.te || election.description;
  }
  if (language === 'hi') {
    return election.description_hi || ELECTIONS_MAP[election.description]?.hi || election.description;
  }
  return election.description_en || election.description;
}
