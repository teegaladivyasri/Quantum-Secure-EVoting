/**
 * Official Legislative Assembly Candidates (2024 General Election)
 * Vizianagaram District (9 Constituencies) & Visakhapatnam District (15 Constituencies)
 */

export interface PresetCandidate {
  name: string;
  party: string;
}

export const AP_OFFICIAL_CANDIDATES: Record<string, PresetCandidate[]> = {
  // Vizianagaram District (9 Constituencies)
  'Bobbili': [
    { name: 'R. V. S. K. K. Ranga Rao (Baby Nayana)', party: 'TDP / NDA Alliance' },
    { name: 'Venkata China Appala Naidu Sambangi', party: 'YSRCP' },
    { name: 'Maripi Vidyasagar (Vinay)', party: 'INC' }
  ],
  'Cheepurupalli': [
    { name: 'Kimidi Kalavenkata Rao', party: 'TDP / NDA Alliance' },
    { name: 'Botcha Satyanarayana', party: 'YSRCP' },
    { name: 'Aadinarayana Jammu', party: 'INC' }
  ],
  'Gajapathinagaram': [
    { name: 'Kondapalli Srinivas', party: 'TDP / NDA Alliance' },
    { name: 'Botcha Appalanarasayya', party: 'YSRCP' },
    { name: 'Dola Srinivas', party: 'INC' }
  ],
  'Kurupam (ST)': [
    { name: 'Jagadeeswari Thoyaka', party: 'TDP / NDA Alliance' },
    { name: 'Pamula Pushpa Sreevani', party: 'YSRCP' },
    { name: 'Mandangi Ramana', party: 'CPI(M)' }
  ],
  'Nellimarla': [
    { name: 'Lokam Naga Madhavi', party: 'Janasena Party / NDA Alliance' },
    { name: 'Appalanaidu Baddukonda', party: 'YSRCP' },
    { name: 'Saragada Ramesh Kumar', party: 'INC' }
  ],
  'Parvathipuram (SC)': [
    { name: 'Bonela Vijaya Chandra', party: 'TDP / NDA Alliance' },
    { name: 'Alajangi Jogarao', party: 'YSRCP' },
    { name: 'Bathina Mohanarao', party: 'INC' }
  ],
  'Salur (ST)': [
    { name: 'Gummidi Sandhyarani', party: 'TDP / NDA Alliance' },
    { name: 'Peedika Rajanna Dora', party: 'YSRCP' },
    { name: 'Muvvala Pushparao', party: 'INC' }
  ],
  'Srungavarapukota': [
    { name: 'Kolla Lalitha Kumari', party: 'TDP / NDA Alliance' },
    { name: 'Kadubandi Srinivasa Rao', party: 'YSRCP' },
    { name: 'Gedela Tirupati', party: 'INC' }
  ],
  'Vizianagaram': [
    { name: 'Aditi Vijayalakshmi Gajapathi Raju Pusapati', party: 'TDP / NDA Alliance' },
    { name: 'Kolagatla Veerabhadra Swamy', party: 'YSRCP' },
    { name: 'Satish Kumar Sunkari', party: 'INC' }
  ],

  // Visakhapatnam District (15 Constituencies)
  'Anakapalle': [
    { name: 'Konathala Ramakrishna', party: 'Janasena Party / NDA Alliance' },
    { name: 'Malasala Bharath Kumar', party: 'YSRCP' },
    { name: 'Illa Rama Gangadhara Rao', party: 'INC' }
  ],
  'Araku Valley (ST)': [
    { name: 'Regam Matyalingam', party: 'YSRCP' },
    { name: 'Rajarao Pangi', party: 'BJP / NDA Alliance' },
    { name: 'Gangadharaswami Setty', party: 'INC' }
  ],
  'Bhimili': [
    { name: 'Ganta Srinivasa Rao', party: 'TDP / NDA Alliance' },
    { name: 'Muttamsetti Srinivasa Rao (Avanthi Srinivas)', party: 'YSRCP' },
    { name: 'Addala Venkata Varma Raju', party: 'INC' }
  ],
  'Chodavaram': [
    { name: 'Surya Naga Sanyasi Raju Kalidindi', party: 'TDP / NDA Alliance' },
    { name: 'Karanam Dharmasri', party: 'YSRCP' },
    { name: 'Jagata Srinivasurao', party: 'INC' }
  ],
  'Gajuwaka': [
    { name: 'Palla Srinivasa Rao Yadav', party: 'TDP / NDA Alliance' },
    { name: 'Amarnath Gudivada', party: 'YSRCP' },
    { name: 'Maradana Jaggunaidu', party: 'CPI(M)' }
  ],
  'Madugula': [
    { name: 'Bandaru Satyanarayana Murthy', party: 'TDP / NDA Alliance' },
    { name: 'Anuradha Erli', party: 'YSRCP' },
    { name: 'Boddu Srinivasa', party: 'INC' }
  ],
  'Narsipatnam': [
    { name: 'Ayyannapatrudu Chintakayala', party: 'TDP / NDA Alliance' },
    { name: 'Uma Sankara Ganesh Petla', party: 'YSRCP' },
    { name: 'Ruthala Srirama Murthy', party: 'INC' }
  ],
  'Paderu (ST)': [
    { name: 'Matsyarasa Visweswara Raju', party: 'YSRCP' },
    { name: 'Eswari Giddi', party: 'TDP / NDA Alliance' },
    { name: 'Bullibabu Sataka', party: 'INC' }
  ],
  'Payakaraopet (SC)': [
    { name: 'Anitha Vangalapudi', party: 'TDP / NDA Alliance' },
    { name: 'Jogulu Kambala', party: 'YSRCP' },
    { name: 'Dr. Boni Tata Rao', party: 'INC' }
  ],
  'Pendurthi': [
    { name: 'Panchakarla Ramesh Babu', party: 'Janasena Party / NDA Alliance' },
    { name: 'Annamreddy Adeep Raj', party: 'YSRCP' },
    { name: 'Bhagat Piridi', party: 'INC' }
  ],
  'Visakhapatnam East': [
    { name: 'Velagapudi Ramakrishna Babu', party: 'TDP / NDA Alliance' },
    { name: 'M. V. V. Satyanarayana', party: 'YSRCP' },
    { name: 'Guthula Srinivas Rao', party: 'INC' }
  ],
  'Visakhapatnam North': [
    { name: 'Penmetsa Vishnu Kumar Raju', party: 'BJP / NDA Alliance' },
    { name: 'Kammila Kannaparaju', party: 'YSRCP' },
    { name: 'Lakkaraju Rama Rao', party: 'INC' }
  ],
  'Visakhapatnam South': [
    { name: 'Vamsi Krishna Srinivas Yadav', party: 'Janasena Party / NDA Alliance' },
    { name: 'Vasupalli Ganesh Kumar', party: 'YSRCP' },
    { name: 'Vasupalli Santosh', party: 'INC' }
  ],
  'Visakhapatnam West': [
    { name: 'P. G. V. R. Naidu (Gana Babu)', party: 'TDP / NDA Alliance' },
    { name: 'Adari Anand Kumar', party: 'YSRCP' },
    { name: 'Attili Vimala', party: 'CPI' }
  ],
  'Yelamanchili': [
    { name: 'Sundarapu Vijay Kumar', party: 'Janasena Party / NDA Alliance' },
    { name: 'Uppalapati Venkata Ramanamurthy Raju', party: 'YSRCP' },
    { name: 'Anantha Rama Narasingarao Thanakala', party: 'INC' }
  ]
};

