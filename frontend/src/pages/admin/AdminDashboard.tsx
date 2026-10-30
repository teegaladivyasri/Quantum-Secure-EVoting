import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import type { Election, Constituency, Candidate, ParticipationStatsResponse, UserProfile } from '../../services/api';
import { 
  Vote, 
  MapPin, 
  Users, 
  UserCheck, 
  BarChart3, 
  ScrollText, 
  Cpu, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  Play, 
  Square, 
  ShieldAlert,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Edit2,
  Save,
  X,
  Sparkles
} from 'lucide-react';
import { AP_OFFICIAL_CANDIDATES } from '../../data/officialCandidates';

interface WizardCandidate {
  tempId: string;
  constituency_id: string;
  name: string;
  party: string;
  ballot_position: number;
}

export const AdminDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'elections' | 'constituencies' | 'candidates' | 'participation' | 'voters' | 'audit' | 'quantum'>('elections');

  // Data states
  const [elections, setElections] = useState<Election[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voters, setVoters] = useState<UserProfile[]>([]);
  const [voterSummary, setVoterSummary] = useState<any>({ total_registered_voters: 0, active_voters: 0, constituency_counts: {} });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [participationStats, setParticipationStats] = useState<ParticipationStatsResponse | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<any>({ simulate_eavesdropping: false, qubit_count: 128 });

  // Filter/Selection states
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Guided Election Creation Wizard States (1: Details, 2: Constituencies, 3: Candidates, 4: Review)
  const [creationStep, setCreationStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardCandidates, setWizardCandidates] = useState<WizardCandidate[]>([]);
  const [candInputs, setCandInputs] = useState<Record<string, { name: string; party: string; ballot_position: string }>>({});
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null);
  const [editingCandidateData, setEditingCandidateData] = useState<{ name: string; party: string; ballot_position: string }>({ name: '', party: '', ballot_position: '' });

  // Phase 14A: Separation of New Election Creation vs Existing Election Management
  const [electionViewMode, setElectionViewMode] = useState<'existing' | 'create'>('existing');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'PUBLISHED' | 'DRAFT' | 'CLOSED'>('ALL');
  const [savedElectionSuccess, setSavedElectionSuccess] = useState<{
    id: string;
    title: string;
    constituenciesCount: number;
    candidatesCount: number;
    configurationStatus: string;
    status: string;
  } | null>(null);
  const [managingElectionId, setManagingElectionId] = useState<string | null>(null);
  const [managingCandidates, setManagingCandidates] = useState<Candidate[]>([]);
  const [draftCandInputs, setDraftCandInputs] = useState<Record<string, { name: string; party: string; ballot_position: string }>>({});
  const [draftEditingCandidateId, setDraftEditingCandidateId] = useState<string | null>(null);
  const [draftEditingCandidateData, setDraftEditingCandidateData] = useState<{ name: string; party: string; ballot_position: string }>({ name: '', party: '', ballot_position: '' });

  // Form states
  const [newElection, setNewElection] = useState({
    title: '',
    description: '',
    election_type: 'State Legislative Assembly',
    state: 'Andhra Pradesh',
    election_date: '',
    voting_open_at: '',
    voting_close_at: '',
    constituency_ids: [] as string[]
  });

  const [newConstituency, setNewConstituency] = useState({
    name: '',
    code: '',
    state: 'Andhra Pradesh'
  });

  const [newCandidate, setNewCandidate] = useState({
    name: '',
    party: '',
    ballot_position: ''
  });

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [eRes, constRes, vRes, aRes, sRes] = await Promise.all([
        api.getElections(),
        api.getConstituencies(),
        api.getVoters(),
        api.getAuditLogs(),
        api.getSimulationConfig()
      ]);

      const loadedElections = eRes.data.elections || [];
      const loadedConsts = constRes.data.constituencies || [];
      setElections(loadedElections);
      setConstituencies(loadedConsts);
      setVoters(vRes.data.voters || []);
      setVoterSummary(vRes.data.summary || {});
      setAuditLogs(aRes.data.audit_logs || []);
      setSimulationConfig(sRes.data);

      const activeEl = loadedElections.find(e => e.status === 'OPEN') || loadedElections[0];
      if (activeEl && !selectedElectionId) {
        setSelectedElectionId(activeEl.id);
      }
      if (loadedConsts.length > 0 && !selectedConstituencyId) {
        setSelectedConstituencyId(loadedConsts[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Failed to load administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // When selected election or constituency changes, load candidates and participation stats
  useEffect(() => {
    if (selectedElectionId) {
      api.getCandidates({ election_id: selectedElectionId, constituency_id: selectedConstituencyId || undefined })
        .then(res => setCandidates(res.data.candidates || []))
        .catch(console.error);

      api.getParticipationStats(selectedElectionId)
        .then(res => setParticipationStats(res.data))
        .catch(() => setParticipationStats(null));
    }
  }, [selectedElectionId, selectedConstituencyId]);

  const selectedElection = elections.find(e => e.id === selectedElectionId);

  // --- Wizard Candidate Handlers ---
  const handleAddWizardCandidate = (constituencyId: string) => {
    setError('');
    const input = candInputs[constituencyId] || { name: '', party: '', ballot_position: '' };
    const name = input.name.trim();
    const party = input.party.trim() || 'Independent';

    if (!name) {
      setError('Candidate name is required.');
      return;
    }

    const constCands = wizardCandidates.filter(c => c.constituency_id === constituencyId);
    if (constCands.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setError(`Candidate '${name}' is already added for this constituency.`);
      return;
    }

    let pos: number;
    if (input.ballot_position && parseInt(input.ballot_position) > 0) {
      pos = parseInt(input.ballot_position);
      if (constCands.some(c => c.ballot_position === pos)) {
        setError(`Ballot position ${pos} is already assigned in this constituency.`);
        return;
      }
    } else {
      const maxPos = constCands.reduce((max, c) => Math.max(max, c.ballot_position), 0);
      pos = maxPos + 1;
    }

    const newCand: WizardCandidate = {
      tempId: `wiz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      constituency_id: constituencyId,
      name,
      party,
      ballot_position: pos
    };

    setWizardCandidates(prev => [...prev, newCand]);
    setCandInputs(prev => ({
      ...prev,
      [constituencyId]: { name: '', party: '', ballot_position: '' }
    }));
  };

  const handleDeleteWizardCandidate = (tempId: string) => {
    setError('');
    const target = wizardCandidates.find(c => c.tempId === tempId);
    if (!target) return;
    const cid = target.constituency_id;
    const filtered = wizardCandidates.filter(c => c.tempId !== tempId);
    // Renumber remaining candidates for this constituency to 1..N
    const constCands = filtered.filter(c => c.constituency_id === cid).sort((a, b) => a.ballot_position - b.ballot_position);
    const renumbered = constCands.map((c, idx) => ({ ...c, ballot_position: idx + 1 }));
    setWizardCandidates([
      ...filtered.filter(c => c.constituency_id !== cid),
      ...renumbered
    ]);
  };

  const handleStartEditWizardCandidate = (cand: WizardCandidate) => {
    setEditingCandidateId(cand.tempId);
    setEditingCandidateData({
      name: cand.name,
      party: cand.party,
      ballot_position: cand.ballot_position.toString()
    });
  };

  const handleSaveEditWizardCandidate = (tempId: string) => {
    const target = wizardCandidates.find(c => c.tempId === tempId);
    if (!target) return;
    const name = editingCandidateData.name.trim();
    const party = editingCandidateData.party.trim() || 'Independent';
    const pos = parseInt(editingCandidateData.ballot_position);

    if (!name) {
      setError('Candidate name cannot be empty.');
      return;
    }
    if (isNaN(pos) || pos <= 0) {
      setError('Ballot position must be a positive integer.');
      return;
    }

    const constCands = wizardCandidates.filter(c => c.constituency_id === target.constituency_id && c.tempId !== tempId);
    if (constCands.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setError(`Candidate '${name}' already exists in this constituency.`);
      return;
    }
    if (constCands.some(c => c.ballot_position === pos)) {
      setError(`Ballot position ${pos} is already assigned in this constituency.`);
      return;
    }

    setError('');
    setWizardCandidates(prev => prev.map(c => c.tempId === tempId ? { ...c, name, party, ballot_position: pos } : c));
    setEditingCandidateId(null);
  };

  const handleLoadOfficialCandidatesForWizard = (constituencyId: string, constituencyName: string) => {
    setError('');
    const official = AP_OFFICIAL_CANDIDATES[constituencyName];
    if (!official || official.length === 0) {
      setError(`No pre-set candidates found for "${constituencyName}". You can enter custom candidates below.`);
      return;
    }
    const otherCands = wizardCandidates.filter(c => c.constituency_id !== constituencyId);
    const newCands: WizardCandidate[] = official.map((cand, idx) => ({
      tempId: `wiz_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
      constituency_id: constituencyId,
      name: cand.name,
      party: cand.party,
      ballot_position: idx + 1
    }));
    setWizardCandidates([...otherCands, ...newCands]);
    setMessage(`Loaded official 2024 candidates for ${constituencyName}. You can review or edit them.`);
  };

  const handleLoadAllOfficialCandidatesForWizard = () => {
    setError('');
    let totalLoaded = 0;
    let newWizardCands = [...wizardCandidates];
    newElection.constituency_ids.forEach(cid => {
      const constObj = constituencies.find(c => c.id === cid);
      if (!constObj) return;
      const official = AP_OFFICIAL_CANDIDATES[constObj.name];
      if (official && official.length > 0) {
        newWizardCands = newWizardCands.filter(c => c.constituency_id !== cid);
        official.forEach((cand, idx) => {
          newWizardCands.push({
            tempId: `wiz_${Date.now()}_${cid}_${idx}_${Math.random().toString(36).substr(2, 6)}`,
            constituency_id: cid,
            name: cand.name,
            party: cand.party,
            ballot_position: idx + 1
          });
          totalLoaded++;
        });
      }
    });
    setWizardCandidates(newWizardCands);
    setMessage(`Loaded official candidates across selected constituencies (${totalLoaded} candidates). You can review or edit them.`);
  };

  const handleResetWizard = () => {
    setNewElection({
      title: '',
      description: '',
      election_type: 'State Legislative Assembly',
      state: 'Example State',
      election_date: '',
      voting_open_at: '',
      voting_close_at: '',
      constituency_ids: []
    });
    setWizardCandidates([]);
    setCandInputs({});
    setEditingCandidateId(null);
    setCreationStep(1);
    setError('');
    setMessage('');
  };

  const handleSaveDraftElection = async () => {
    setError('');
    setMessage('');

    if (!newElection.title.trim()) {
      setError('Election title is required.');
      setCreationStep(1);
      return;
    }
    if (newElection.constituency_ids.length === 0) {
      setError('Please select at least one participating constituency.');
      setCreationStep(2);
      return;
    }

    // Validate every selected constituency has candidate configuration
    const incompleteConsts = newElection.constituency_ids.filter(
      cid => !wizardCandidates.some(c => c.constituency_id === cid)
    );
    if (incompleteConsts.length > 0) {
      const names = incompleteConsts.map(id => constituencies.find(c => c.id === id)?.name || id);
      setError(`Candidate configuration incomplete for: ${names.join(', ')}. Please configure at least one candidate for every selected constituency.`);
      setCreationStep(3);
      return;
    }

    try {
      const candidatesPayload = wizardCandidates.map(c => ({
        constituency_id: c.constituency_id,
        name: c.name,
        party: c.party,
        ballot_position: c.ballot_position
      }));

      const res = await api.createElection({
        title: newElection.title.trim(),
        description: newElection.description ? newElection.description.trim() : undefined,
        election_type: newElection.election_type,
        state: newElection.state,
        election_date: newElection.election_date || undefined,
        voting_open_at: newElection.voting_open_at ? new Date(newElection.voting_open_at).toISOString() : undefined,
        voting_close_at: newElection.voting_close_at ? new Date(newElection.voting_close_at).toISOString() : undefined,
        constituency_ids: newElection.constituency_ids,
        candidates: candidatesPayload
      });

      const savedEl = res.data.election;
      const candidatesCount = candidatesPayload.length;
      const constituenciesCount = newElection.constituency_ids.length;

      setSavedElectionSuccess({
        id: savedEl.id,
        title: savedEl.title,
        constituenciesCount,
        candidatesCount,
        configurationStatus: savedEl.configuration_status || 'COMPLETE',
        status: 'DRAFT'
      });
      setMessage(`Election '${savedEl.title}' saved successfully as Draft with ${candidatesCount} candidate(s) configured!`);
      handleResetWizard();
      await loadAllData();
      setSelectedElectionId(savedEl.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save draft election.');
    }
  };

  const loadManagingElectionData = async (electionId: string) => {
    try {
      const [candRes, statsRes] = await Promise.all([
        api.getCandidates({ election_id: electionId }),
        api.getParticipationStats(electionId).catch(() => null)
      ]);
      setManagingCandidates(candRes.data.candidates || []);
      if (statsRes && statsRes.data) {
        setParticipationStats(statsRes.data);
      } else {
        setParticipationStats(null);
      }
    } catch (err: any) {
      console.error('Failed to load managing election details:', err);
    }
  };

  const handleInspectElection = async (id: string) => {
    setSelectedElectionId(id);
    setManagingElectionId(id);
    setError('');
    setMessage('');
    await loadManagingElectionData(id);
  };

  const handleBackToExistingList = () => {
    setManagingElectionId(null);
    setError('');
    setMessage('');
  };

  const handleAddCandidateToDraft = async (constituencyId: string) => {
    if (!managingElectionId) return;
    const inputVal = draftCandInputs[constituencyId] || { name: '', party: '', ballot_position: '' };
    const name = inputVal.name.trim();
    const party = inputVal.party.trim() || 'Independent';
    const pos = inputVal.ballot_position ? parseInt(inputVal.ballot_position) : undefined;

    if (!name) {
      setError('Candidate name is required.');
      return;
    }

    try {
      await api.createCandidate({
        election_id: managingElectionId,
        constituency_id: constituencyId,
        name,
        party,
        ballot_position: pos
      });
      setMessage(`Candidate '${name}' registered into constituency roster.`);
      setDraftCandInputs(prev => ({
        ...prev,
        [constituencyId]: { name: '', party: '', ballot_position: '' }
      }));
      await loadManagingElectionData(managingElectionId);
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add candidate.');
    }
  };

  const handleLoadOfficialCandidatesForDraft = async (constituencyId: string, constituencyName: string) => {
    if (!managingElectionId) return;
    const official = AP_OFFICIAL_CANDIDATES[constituencyName];
    if (!official || official.length === 0) {
      setError(`No pre-set candidates found for "${constituencyName}". You can enter custom candidates below.`);
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const constCands = managingCandidates.filter(c => c.constituency_id === constituencyId && !c.is_nota);
      let nextPos = constCands.reduce((max, c) => Math.max(max, c.ballot_position), 0) + 1;
      for (const cand of official) {
        if (!constCands.some(c => c.name.toLowerCase() === cand.name.toLowerCase())) {
          await api.createCandidate({
            election_id: managingElectionId,
            constituency_id: constituencyId,
            name: cand.name,
            party: cand.party,
            ballot_position: nextPos++
          });
        }
      }
      setMessage(`Official candidates loaded for ${constituencyName}.`);
      await loadManagingElectionData(managingElectionId);
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load official candidates.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraftCandidate = async (candidateId: string) => {
    if (!managingElectionId) return;
    try {
      await api.deleteCandidate(candidateId);
      setMessage('Candidate removed from constituency roster.');
      await loadManagingElectionData(managingElectionId);
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove candidate.');
    }
  };

  const handleStartEditDraftCandidate = (cand: Candidate) => {
    setDraftEditingCandidateId(cand.id);
    setDraftEditingCandidateData({
      name: cand.name,
      party: cand.party,
      ballot_position: cand.ballot_position.toString()
    });
  };

  const handleSaveEditDraftCandidate = async (candidateId: string) => {
    if (!managingElectionId) return;
    const name = draftEditingCandidateData.name.trim();
    const party = draftEditingCandidateData.party.trim() || 'Independent';
    const pos = parseInt(draftEditingCandidateData.ballot_position);

    if (!name) {
      setError('Candidate name cannot be empty.');
      return;
    }
    if (isNaN(pos) || pos <= 0) {
      setError('Ballot position must be a positive integer.');
      return;
    }

    try {
      await api.updateCandidate(candidateId, {
        name,
        party,
        ballot_position: pos
      });
      setMessage(`Candidate '${name}' updated.`);
      setDraftEditingCandidateId(null);
      await loadManagingElectionData(managingElectionId);
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update candidate.');
    }
  };

  const handleUpdateStatus = async (electionId: string, status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED') => {
    setError('');
    setMessage('');
    try {
      const res = await api.updateElectionStatus(electionId, status);
      setMessage(`Election status successfully transitioned to ${res.data.election.status}.`);
      await loadAllData();
      if (managingElectionId === electionId) {
        await loadManagingElectionData(electionId);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to transition election status.');
    }
  };

  const handleDeleteElection = async (electionId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete the election "${title}"? This cannot be undone.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.deleteElection(electionId);
      setMessage(`Election "${title}" and all associated records deleted successfully.`);
      if (managingElectionId === electionId) {
        setManagingElectionId(null);
      }
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete election.');
    }
  };

  const handleCreateConstituency = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.createConstituency(newConstituency);
      setMessage(`Constituency '${newConstituency.name}' created!`);
      setNewConstituency({ name: '', code: '', state: 'Example State' });
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create constituency.');
    }
  };

  const handleAddConstituencyToElection = async (constituencyId: string) => {
    if (!selectedElectionId) return;
    setError('');
    setMessage('');
    try {
      await api.addElectionConstituency(selectedElectionId, constituencyId);
      setMessage('Constituency linked to election with auto-provisioned NOTA candidate.');
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to link constituency.');
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedElectionId || !selectedConstituencyId) {
      setError('Please select both an election and a constituency.');
      return;
    }
    setError('');
    setMessage('');
    try {
      await api.createCandidate({
        election_id: selectedElectionId,
        constituency_id: selectedConstituencyId,
        name: newCandidate.name,
        party: newCandidate.party || 'Independent',
        ballot_position: newCandidate.ballot_position ? parseInt(newCandidate.ballot_position) : undefined
      });
      setMessage(`Candidate '${newCandidate.name}' added to constituency roster!`);
      setNewCandidate({ name: '', party: '', ballot_position: '' });
      // Reload candidates
      const res = await api.getCandidates({ election_id: selectedElectionId, constituency_id: selectedConstituencyId });
      setCandidates(res.data.candidates || []);
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add candidate.');
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!selectedElectionId) return;
    setError('');
    setMessage('');
    try {
      await api.deleteCandidate(candidateId);
      setMessage('Candidate removed from constituency roster.');
      if (selectedConstituencyId) {
        const res = await api.getCandidates({ election_id: selectedElectionId, constituency_id: selectedConstituencyId });
        setCandidates(res.data.candidates || []);
      }
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove candidate.');
    }
  };

  const handleToggleSimulation = async () => {
    try {
      const nextSim = !simulationConfig.simulate_eavesdropping;
      const res = await api.updateSimulationConfig({ simulate_eavesdropping: nextSim });
      setSimulationConfig(res.data);
      setMessage(nextSim ? 'Simulated Eve eavesdropping enabled (~25% QBER rejection)' : 'Clean quantum channel restored');
    } catch {
      setError('Failed to update simulation config');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="gold-badge" style={{ marginBottom: '0.4rem' }}>Election Administration</div>
          <h2>{t('adminDashboard')}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Authoritative lifecycle control, constituency balloting units, candidate rosters, and aggregate participation telemetry.
          </p>
        </div>

        <button onClick={loadAllData} className="btn btn-outline" style={{ minHeight: '40px' }} title="Refresh all data">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Console</span>
        </button>
      </div>

      {message && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '2px solid var(--border-subtle)',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setActiveTab('elections')}
          className={`btn ${activeTab === 'elections' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <Vote size={16} />
          <span>Elections ({elections.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('constituencies')}
          className={`btn ${activeTab === 'constituencies' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <MapPin size={16} />
          <span>Constituencies ({constituencies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          className={`btn ${activeTab === 'candidates' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <UserCheck size={16} />
          <span>Candidate Rosters</span>
        </button>

        <button
          onClick={() => setActiveTab('participation')}
          className={`btn ${activeTab === 'participation' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <BarChart3 size={16} />
          <span>Participation Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab('voters')}
          className={`btn ${activeTab === 'voters' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <Users size={16} />
          <span>Voter Registry (Read-Only)</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`btn ${activeTab === 'audit' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <ScrollText size={16} />
          <span>Audit Logs ({auditLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quantum')}
          className={`btn ${activeTab === 'quantum' ? 'btn-gold' : 'btn-outline'}`}
          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
        >
          <Cpu size={16} />
          <span>Quantum Lab (BB84)</span>
        </button>
      </div>

      {/* TAB 1: ELECTIONS */}
      {activeTab === 'elections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section Navigation Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            background: 'var(--bg-surface)',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Vote size={22} color="var(--color-soft-gold)" />
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Elections Console</h3>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {electionViewMode === 'create'
                  ? 'Guided Election Creation — Configure parameters, constituency rosters, and review before saving.'
                  : managingElectionId
                  ? `Election Management Console — ${elections.find(e => e.id === managingElectionId)?.title || 'Selected Election'}`
                  : 'Manage previously registered elections, review constituency readiness, and monitor active civic voting.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setElectionViewMode('existing');
                  setManagingElectionId(null);
                  setSavedElectionSuccess(null);
                }}
                className={`btn ${electionViewMode === 'existing' && !managingElectionId ? 'btn-gold' : 'btn-outline'}`}
                style={{ minHeight: '38px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              >
                <Vote size={15} />
                <span>Existing Elections ({elections.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleResetWizard();
                  setSavedElectionSuccess(null);
                  setManagingElectionId(null);
                  setElectionViewMode('create');
                }}
                className={`btn ${electionViewMode === 'create' ? 'btn-gold' : 'btn-outline'}`}
                style={{ minHeight: '38px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
              >
                <Plus size={16} />
                <span>Create New Election</span>
              </button>
            </div>
          </div>

          {/* ============================================================
              WORKFLOW A: CREATE NEW ELECTION (Guided Wizard Experience)
              ============================================================ */}
          {electionViewMode === 'create' && (
            <div>
              {savedElectionSuccess ? (
                /* Success State Screen (Requirement 3) */
                <div className="glass-card" style={{ maxWidth: '840px', margin: '0 auto', textAlign: 'center', padding: '2.5rem 2rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    padding: '1.25rem',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--color-success)',
                    marginBottom: '1.25rem',
                    border: '1px solid rgba(34, 197, 94, 0.3)'
                  }}>
                    <CheckCircle size={52} />
                  </div>

                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem', color: 'var(--text-primary)' }}>
                    Election saved successfully as Draft.
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
                    The election record, electoral constituency allocations, and candidate rosters have been committed to the election registry in <strong>DRAFT</strong> status. The election is neither published nor open for voting.
                  </p>

                  {/* Summary Details */}
                  <div style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1.5rem',
                    textAlign: 'left',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1.25rem',
                    marginBottom: '2rem'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Election Name</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                        {savedElectionSuccess.title}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Status</div>
                      <div style={{ marginTop: '0.35rem' }}>
                        <span className="gold-badge" style={{ borderColor: 'var(--color-soft-gold)', color: 'var(--color-soft-gold)', fontSize: '0.8rem', fontWeight: 700 }}>
                          {savedElectionSuccess.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participating Constituencies</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                        {savedElectionSuccess.constituenciesCount} Constituenc{savedElectionSuccess.constituenciesCount === 1 ? 'y' : 'ies'}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configured Candidates</div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                        {savedElectionSuccess.candidatesCount} Candidates
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Configuration Status</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                        <span className="gold-badge" style={{
                          borderColor: savedElectionSuccess.configurationStatus === 'COMPLETE' ? 'var(--color-success)' : 'var(--color-danger)',
                          color: savedElectionSuccess.configurationStatus === 'COMPLETE' ? 'var(--color-success)' : 'var(--color-danger)',
                          fontSize: '0.8rem',
                          fontWeight: 700
                        }}>
                          {savedElectionSuccess.configurationStatus}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {savedElectionSuccess.configurationStatus === 'COMPLETE'
                            ? 'All constituencies have valid candidate rosters and auto-provisioned NOTA options.'
                            : 'Candidate configuration incomplete.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Navigation Actions */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSavedElectionSuccess(null);
                        setElectionViewMode('existing');
                        setManagingElectionId(null);
                      }}
                      className="btn btn-gold"
                      style={{ minHeight: '42px', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      <Vote size={16} />
                      <span>View Existing Elections</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const id = savedElectionSuccess.id;
                        setSavedElectionSuccess(null);
                        setElectionViewMode('existing');
                        handleInspectElection(id);
                      }}
                      className="btn btn-outline"
                      style={{ minHeight: '42px', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      <Edit2 size={16} />
                      <span>View This Election</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleResetWizard();
                        setSavedElectionSuccess(null);
                        setCreationStep(1);
                      }}
                      className="btn btn-outline"
                      style={{ minHeight: '42px', padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}
                    >
                      <Plus size={16} />
                      <span>Create New Election</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Step-by-Step Guided Election Creation Wizard */
                <div className="glass-card" style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Header & Step Tracker */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} color="var(--color-soft-gold)" />
                        <h3 style={{ margin: 0 }}>Create New Election</h3>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setElectionViewMode('existing');
                            setManagingElectionId(null);
                          }}
                          className="btn btn-outline"
                          style={{ minHeight: '30px', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          <ArrowLeft size={13} />
                          <span>Back to Existing Elections</span>
                        </button>
                        {creationStep > 1 && (
                          <button
                            type="button"
                            onClick={handleResetWizard}
                            className="btn btn-outline"
                            style={{ minHeight: '30px', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                            title="Reset creation wizard"
                          >
                            <X size={13} />
                            <span>Reset Form</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                      Define election metadata, select participating constituencies, and configure candidate rosters in a single guided sequence.
                    </p>
                  </div>

                  {/* Stepper Progress Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-surface)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: creationStep === 1 ? 'var(--color-soft-gold)' : creationStep > 1 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: creationStep === 1 ? 700 : 500, fontSize: '0.85rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: creationStep === 1 ? 'var(--color-soft-gold)' : creationStep > 1 ? 'var(--color-success)' : 'rgba(255,255,255,0.1)', color: creationStep >= 1 ? '#000' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {creationStep > 1 ? '✓' : '1'}
                      </span>
                      <span>Step 1: Details</span>
                    </div>
                    <span style={{ color: 'var(--border-subtle)' }}>→</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: creationStep === 2 ? 'var(--color-soft-gold)' : creationStep > 2 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: creationStep === 2 ? 700 : 500, fontSize: '0.85rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: creationStep === 2 ? 'var(--color-soft-gold)' : creationStep > 2 ? 'var(--color-success)' : 'rgba(255,255,255,0.1)', color: creationStep >= 2 ? '#000' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {creationStep > 2 ? '✓' : '2'}
                      </span>
                      <span>Step 2: Constituencies ({newElection.constituency_ids.length})</span>
                    </div>
                    <span style={{ color: 'var(--border-subtle)' }}>→</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: creationStep === 3 ? 'var(--color-soft-gold)' : creationStep > 3 ? 'var(--color-success)' : 'var(--text-muted)', fontWeight: creationStep === 3 ? 700 : 500, fontSize: '0.85rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: creationStep === 3 ? 'var(--color-soft-gold)' : creationStep > 3 ? 'var(--color-success)' : 'rgba(255,255,255,0.1)', color: creationStep >= 3 ? '#000' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        {creationStep > 3 ? '✓' : '3'}
                      </span>
                      <span>Step 3: Candidates ({wizardCandidates.length})</span>
                    </div>
                    <span style={{ color: 'var(--border-subtle)' }}>→</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: creationStep === 4 ? 'var(--color-soft-gold)' : 'var(--text-muted)', fontWeight: creationStep === 4 ? 700 : 500, fontSize: '0.85rem' }}>
                      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: creationStep === 4 ? 'var(--color-soft-gold)' : 'rgba(255,255,255,0.1)', color: creationStep === 4 ? '#000' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                        4
                      </span>
                      <span>Step 4: Review & Save</span>
                    </div>
                  </div>

                  {/* STEP 1: ELECTION DETAILS */}
                  {creationStep === 1 && (
                    <div>
                      <h4 style={{ margin: '0 0 1rem 0', color: 'var(--color-soft-gold)' }}>Step 1 — Election Details</h4>
                      <div className="form-group">
                        <label className="form-label">Election Title *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={newElection.title}
                          onChange={e => setNewElection({ ...newElection, title: e.target.value })}
                          placeholder="e.g. State Legislative Assembly Election 2026"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          value={newElection.description}
                          onChange={e => setNewElection({ ...newElection, description: e.target.value })}
                          placeholder="Civic guidelines and legislative scope..."
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Election Type</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newElection.election_type}
                            onChange={e => setNewElection({ ...newElection, election_type: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">State / Region</label>
                          <input
                            type="text"
                            className="form-control"
                            value={newElection.state}
                            onChange={e => setNewElection({ ...newElection, state: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Election Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={newElection.election_date}
                          onChange={e => setNewElection({ ...newElection, election_date: e.target.value })}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        <div className="form-group">
                          <label className="form-label">Voting Opens At</label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            value={newElection.voting_open_at}
                            onChange={e => setNewElection({ ...newElection, voting_open_at: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Voting Closes At</label>
                          <input
                            type="datetime-local"
                            className="form-control"
                            value={newElection.voting_close_at}
                            onChange={e => setNewElection({ ...newElection, voting_close_at: e.target.value })}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newElection.title.trim()) {
                              setError('Election title is required.');
                              return;
                            }
                            if (newElection.voting_open_at && newElection.voting_close_at && newElection.voting_close_at <= newElection.voting_open_at) {
                              setError('Voting close time must be after open time.');
                              return;
                            }
                            setError('');
                            setCreationStep(2);
                          }}
                          className="btn btn-gold"
                          style={{ minHeight: '40px', padding: '0.5rem 1.25rem' }}
                        >
                          <span>Continue to Step 2: Select Constituencies</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: SELECT CONSTITUENCIES */}
                  {creationStep === 2 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <h4 style={{ margin: 0, color: 'var(--color-soft-gold)' }}>Step 2 — Select Participating Constituencies</h4>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Choose electoral constituencies participating in this election cycle.
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() => setNewElection({ ...newElection, constituency_ids: constituencies.map(c => c.id) })}
                            className="btn btn-outline"
                            style={{ minHeight: '28px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => setNewElection({ ...newElection, constituency_ids: [] })}
                            className="btn btn-outline"
                            style={{ minHeight: '28px', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        maxHeight: '320px',
                        overflowY: 'auto',
                        padding: '0.75rem',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)'
                      }}>
                        {constituencies.map(c => {
                          const isChecked = newElection.constituency_ids.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.5rem 0.75rem',
                                background: isChecked ? 'var(--bg-surface-elevated)' : 'transparent',
                                borderRadius: 'var(--radius-sm)',
                                border: isChecked ? '1px solid var(--color-soft-gold)' : '1px solid transparent',
                                cursor: 'pointer',
                                fontSize: '0.9rem'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setNewElection({ ...newElection, constituency_ids: [...newElection.constituency_ids, c.id] });
                                    } else {
                                      setNewElection({ ...newElection, constituency_ids: newElection.constituency_ids.filter(id => id !== c.id) });
                                    }
                                  }}
                                />
                                <span style={{ fontWeight: 600 }}>{c.name}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({c.code})</span>
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.state}</span>
                            </label>
                          );
                        })}
                        {constituencies.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                            No electoral constituencies defined in registry. Please add constituencies first.
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', color: newElection.constituency_ids.length > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          Selected: <strong>{newElection.constituency_ids.length}</strong> constituenc{newElection.constituency_ids.length === 1 ? 'y' : 'ies'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.25rem', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => { setError(''); setCreationStep(1); }}
                          className="btn btn-outline"
                          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
                        >
                          <ArrowLeft size={16} />
                          <span>Back: Election Details</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (newElection.constituency_ids.length === 0) {
                              setError('Please select at least one participating constituency.');
                              return;
                            }
                            setError('');
                            setCreationStep(3);
                          }}
                          disabled={newElection.constituency_ids.length === 0}
                          className="btn btn-gold"
                          style={{ minHeight: '40px', padding: '0.5rem 1.25rem' }}
                        >
                          <span>Continue to Step 3: Configure Candidates</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: CONFIGURE CANDIDATES */}
                  {creationStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                        <div>
                          <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--color-soft-gold)' }}>Step 3 — Configure Candidates by Constituency</h4>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Add candidates dynamically for each constituency or use the 1-click official load button. NOTA is auto-included.
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleLoadAllOfficialCandidatesForWizard}
                          className="btn btn-outline"
                          style={{ borderColor: 'var(--color-soft-gold)', color: 'var(--color-soft-gold)', fontSize: '0.8rem', padding: '0.35rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                          title="Auto-fill official 2024 candidates across all selected constituencies"
                        >
                          <Sparkles size={14} />
                          <span>Load All Official 2024 Candidates</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '460px', overflowY: 'auto', paddingRight: '0.3rem' }}>
                        {newElection.constituency_ids.map(cid => {
                          const constObj = constituencies.find(c => c.id === cid);
                          const cname = constObj?.name || cid;
                          const constCands = wizardCandidates
                            .filter(c => c.constituency_id === cid)
                            .sort((a, b) => a.ballot_position - b.ballot_position);
                          const inputVal = candInputs[cid] || { name: '', party: '', ballot_position: '' };
                          const nextSuggestedPos = constCands.length + 1;

                          return (
                            <div
                              key={cid}
                              style={{
                                background: 'var(--bg-surface)',
                                border: `1px solid ${constCands.length > 0 ? 'var(--border-subtle)' : 'var(--color-danger)'}`,
                                borderRadius: 'var(--radius-sm)',
                                padding: '1rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.8rem'
                              }}
                            >
                              {/* Constituency Header */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <MapPin size={16} color="var(--color-soft-gold)" />
                                  <strong style={{ fontSize: '1rem' }}>{cname}</strong>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({constObj?.code || ''})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {AP_OFFICIAL_CANDIDATES[cname] && (
                                    <button
                                      type="button"
                                      onClick={() => handleLoadOfficialCandidatesForWizard(cid, cname)}
                                      className="btn btn-outline"
                                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.65rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                      title={`Load official 2024 candidates for ${cname}`}
                                    >
                                      <Sparkles size={12} color="var(--color-soft-gold)" />
                                      <span>Load 2024 Candidates</span>
                                    </button>
                                  )}
                                  <span
                                    className="gold-badge"
                                    style={{
                                      borderColor: constCands.length > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                                      color: constCands.length > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {constCands.length > 0 ? `${constCands.length} Cand + NOTA (${constCands.length + 1} options)` : 'Incomplete (0 candidates)'}
                                  </span>
                                </div>
                              </div>

                              {/* Candidates Table */}
                              <div className="table-responsive">
                                <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                  <thead>
                                    <tr>
                                      <th style={{ width: '50px' }}>Pos</th>
                                      <th>Candidate Name</th>
                                      <th>Party</th>
                                      <th style={{ width: '90px' }}>Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {constCands.map(cand => {
                                      const isEditing = editingCandidateId === cand.tempId;
                                      if (isEditing) {
                                        return (
                                          <tr key={cand.tempId}>
                                            <td>
                                              <input
                                                type="number"
                                                min="1"
                                                style={{ width: '45px', padding: '0.2rem' }}
                                                value={editingCandidateData.ballot_position}
                                                onChange={e => setEditingCandidateData({ ...editingCandidateData, ballot_position: e.target.value })}
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="text"
                                                className="form-control"
                                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                                value={editingCandidateData.name}
                                                onChange={e => setEditingCandidateData({ ...editingCandidateData, name: e.target.value })}
                                              />
                                            </td>
                                            <td>
                                              <input
                                                type="text"
                                                className="form-control"
                                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                                value={editingCandidateData.party}
                                                onChange={e => setEditingCandidateData({ ...editingCandidateData, party: e.target.value })}
                                              />
                                            </td>
                                            <td>
                                              <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSaveEditWizardCandidate(cand.tempId)}
                                                  className="btn btn-gold"
                                                  style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                  title="Save Candidate"
                                                >
                                                  <Save size={12} />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => setEditingCandidateId(null)}
                                                  className="btn btn-outline"
                                                  style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                  title="Cancel Edit"
                                                >
                                                  <X size={12} />
                                                </button>
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      }

                                      return (
                                        <tr key={cand.tempId}>
                                          <td>
                                            <strong style={{ color: 'var(--color-soft-gold)' }}>
                                              {cand.ballot_position < 10 ? `0${cand.ballot_position}` : cand.ballot_position}
                                            </strong>
                                          </td>
                                          <td><strong>{cand.name}</strong></td>
                                          <td>{cand.party}</td>
                                          <td>
                                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                                              <button
                                                type="button"
                                                onClick={() => handleStartEditWizardCandidate(cand)}
                                                className="btn btn-outline"
                                                style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                title="Edit Candidate"
                                              >
                                                <Edit2 size={12} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteWizardCandidate(cand.tempId)}
                                                className="btn btn-outline"
                                                style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderColor: '#ef4444', color: '#f87171' }}
                                                title="Remove Candidate"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* NOTA Row - Strictly positioned last */}
                                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                      <td>
                                        <strong style={{ color: 'var(--text-muted)' }}>
                                          {nextSuggestedPos < 10 ? `0${nextSuggestedPos}` : nextSuggestedPos}
                                        </strong>
                                      </td>
                                      <td>
                                        <strong>None of the Above (NOTA)</strong>
                                      </td>
                                      <td>NOTA</td>
                                      <td>
                                        <span className="gold-badge" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                          NOTA (Last)
                                        </span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Incomplete warning if 0 standard candidates */}
                              {constCands.length === 0 && (
                                <div style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                                  Candidate configuration incomplete for {cname}. Add at least one candidate.
                                </div>
                              )}

                              {/* Inline Add Candidate Form */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) auto',
                                gap: '0.5rem',
                                background: 'var(--bg-surface-elevated)',
                                padding: '0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                alignItems: 'center'
                              }}>
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                  placeholder="Candidate Name *"
                                  value={inputVal.name}
                                  onChange={e => setCandInputs({
                                    ...candInputs,
                                    [cid]: { ...inputVal, name: e.target.value }
                                  })}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWizardCandidate(cid); } }}
                                />

                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                  placeholder="Party (or 'Independent')"
                                  value={inputVal.party}
                                  onChange={e => setCandInputs({
                                    ...candInputs,
                                    [cid]: { ...inputVal, party: e.target.value }
                                  })}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWizardCandidate(cid); } }}
                                />

                                <input
                                  type="number"
                                  min="1"
                                  className="form-control"
                                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                  placeholder={`Pos (${nextSuggestedPos})`}
                                  value={inputVal.ballot_position}
                                  onChange={e => setCandInputs({
                                    ...candInputs,
                                    [cid]: { ...inputVal, ballot_position: e.target.value }
                                  })}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddWizardCandidate(cid); } }}
                                />

                                <button
                                  type="button"
                                  onClick={() => handleAddWizardCandidate(cid)}
                                  className="btn btn-gold"
                                  style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                                >
                                  <Plus size={14} />
                                  <span>Add</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => { setError(''); setCreationStep(2); }}
                          className="btn btn-outline"
                          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
                        >
                          <ArrowLeft size={16} />
                          <span>Back: Constituencies</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const missing = newElection.constituency_ids.filter(id => !wizardCandidates.some(cand => cand.constituency_id === id));
                            if (missing.length > 0) {
                              const missingNames = missing.map(id => constituencies.find(c => c.id === id)?.name || id);
                              setError(`Candidate configuration incomplete for: ${missingNames.join(', ')}. Configure candidates for all constituencies before proceeding.`);
                              return;
                            }
                            setError('');
                            setCreationStep(4);
                          }}
                          className="btn btn-gold"
                          style={{ minHeight: '40px', padding: '0.5rem 1.25rem' }}
                        >
                          <span>Continue to Step 4: Review Configuration</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: REVIEW & SAVE DRAFT */}
                  {creationStep === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.3rem 0', color: 'var(--color-soft-gold)' }}>Step 4 — Review Configuration & Save Draft</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Verify election parameters and constituency candidate rosters before saving. Election will be stored strictly in <strong>DRAFT</strong> status.
                        </div>
                      </div>

                      <div style={{
                        background: 'var(--bg-surface)',
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem'
                      }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Election: </span>
                            <strong>{newElection.title}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                            <span>{newElection.election_type}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>State: </span>
                            <span>{newElection.state}</span>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                            <span>{newElection.election_date || 'Not specified'}</span>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Voting Hours: </span>
                            <span>
                              {newElection.voting_open_at ? new Date(newElection.voting_open_at).toLocaleString() : 'N/A'} – {newElection.voting_close_at ? new Date(newElection.voting_close_at).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Participating Constituencies: </span>
                            <strong>{newElection.constituency_ids.length}</strong>
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.8rem' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Constituency Balloting Rosters Breakdown:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                            {newElection.constituency_ids.map(cid => {
                              const constObj = constituencies.find(c => c.id === cid);
                              const cname = constObj?.name || cid;
                              const cands = wizardCandidates.filter(c => c.constituency_id === cid);
                              const isComplete = cands.length > 0;

                              return (
                                <div
                                  key={cid}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.5rem 0.75rem',
                                    background: 'var(--bg-surface-elevated)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.85rem'
                                  }}
                                >
                                  <div>
                                    <strong>{cname}</strong>: {cands.length + 1} ballot options ({cands.length} candidate{cands.length !== 1 ? 's' : ''} + NOTA)
                                  </div>
                                  <span
                                    className="gold-badge"
                                    style={{
                                      borderColor: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                      color: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                      fontSize: '0.75rem'
                                    }}
                                  >
                                    {isComplete ? 'COMPLETE' : 'INCOMPLETE'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Configuration Status Summary */}
                        {(() => {
                          const incomplete = newElection.constituency_ids.filter(id => !wizardCandidates.some(c => c.constituency_id === id));
                          const isFullyComplete = incomplete.length === 0 && newElection.constituency_ids.length > 0;
                          return (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.75rem 1rem',
                              background: isFullyComplete ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              border: `1px solid ${isFullyComplete ? 'var(--color-success)' : 'var(--color-danger)'}`,
                              borderRadius: 'var(--radius-sm)',
                              marginTop: '0.5rem',
                              flexWrap: 'wrap',
                              gap: '0.5rem'
                            }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: isFullyComplete ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                  Configuration: {isFullyComplete ? 'COMPLETE' : 'INCOMPLETE'}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                  {isFullyComplete
                                    ? 'All participating constituencies configured with candidates and NOTA. Ready to save as DRAFT.'
                                    : `Candidate configuration incomplete for ${incomplete.length} constituenc${incomplete.length === 1 ? 'y' : 'ies'}.`
                                  }
                                </div>
                              </div>

                              <span className="gold-badge" style={{ borderColor: isFullyComplete ? 'var(--color-success)' : 'var(--color-danger)', color: isFullyComplete ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                {isFullyComplete ? 'VALIDATED' : 'ACTION REQUIRED'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => { setError(''); setCreationStep(3); }}
                          className="btn btn-outline"
                          style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
                        >
                          <ArrowLeft size={16} />
                          <span>Back: Edit Candidates</span>
                        </button>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              handleResetWizard();
                              setElectionViewMode('existing');
                            }}
                            className="btn btn-outline"
                            style={{ minHeight: '40px', padding: '0.5rem 1rem' }}
                          >
                            <span>Cancel</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveDraftElection}
                            className="btn btn-gold"
                            style={{ minHeight: '40px', padding: '0.5rem 1.25rem' }}
                          >
                            <Save size={16} />
                            <span>Save as Draft</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              WORKFLOW B: EXISTING ELECTIONS (Management & Status Filtering)
              ============================================================ */}
          {electionViewMode === 'existing' && (
            <div>
              {managingElectionId ? (
                /* Sub-view: Specific Election Management Console */
                (() => {
                  const elec = elections.find(e => e.id === managingElectionId);
                  if (!elec) {
                    return (
                      <div className="glass-card" style={{ textAlign: 'center', padding: '2rem' }}>
                        <p>Election record not found.</p>
                        <button onClick={handleBackToExistingList} className="btn btn-gold">
                          Return to Existing Elections
                        </button>
                      </div>
                    );
                  }

                  const isComplete = elec.configuration_status === 'COMPLETE';
                  const statusColor = elec.status === 'OPEN'
                    ? 'var(--color-success)'
                    : elec.status === 'PUBLISHED'
                    ? '#3b82f6'
                    : elec.status === 'DRAFT'
                    ? 'var(--color-soft-gold)'
                    : '#ef4444';

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {/* Top Bar for Election Management */}
                      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <button
                            type="button"
                            onClick={handleBackToExistingList}
                            className="btn btn-outline"
                            style={{ minHeight: '34px', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <ArrowLeft size={14} />
                            <span>Back to Existing Elections</span>
                          </button>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            {elec.status === 'OPEN' ? (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.35rem 0.85rem',
                                borderRadius: '9999px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                border: '1px solid var(--color-success)',
                                color: 'var(--color-success)',
                                background: 'rgba(34, 197, 94, 0.15)',
                                boxShadow: '0 0 10px rgba(34, 197, 94, 0.25)'
                              }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 8px var(--color-success)' }}></span>
                                <span>OPEN / ACTIVE</span>
                              </div>
                            ) : (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: `1px solid ${statusColor}`,
                                color: statusColor,
                                background: 'rgba(0,0,0,0.3)'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></span>
                                <span>{elec.status}</span>
                              </div>
                            )}

                            <span
                              className="gold-badge"
                              style={{
                                borderColor: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                color: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                fontSize: '0.75rem'
                              }}
                            >
                              Configuration: {elec.configuration_status || 'INCOMPLETE'}
                            </span>
                          </div>
                        </div>

                        {/* Title and metadata */}
                        <div>
                          <h2 style={{ margin: '0 0 0.4rem 0', fontSize: '1.4rem' }}>{elec.title}</h2>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {elec.description || 'No description recorded.'}
                          </div>
                        </div>

                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '0.75rem',
                          background: 'var(--bg-surface-elevated)',
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem'
                        }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>State / Region: </span>
                            <strong>{elec.state}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Election Type: </span>
                            <strong>{elec.election_type}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>
                              <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                              Election Date:
                            </span>
                            <strong>{elec.election_date || 'N/A'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Constituencies: </span>
                            <strong>{elec.participating_constituencies?.length || 0}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Candidates: </span>
                            <strong>{elec.candidates_count || managingCandidates.filter(c => !c.is_nota).length}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Voting Window: </span>
                            <span>{elec.voting_open_at ? new Date(elec.voting_open_at).toLocaleDateString() : 'N/A'} – {elec.voting_close_at ? new Date(elec.voting_close_at).toLocaleDateString() : 'N/A'}</span>
                          </div>
                        </div>

                        {/* Top Lifecycle Action Toolbar */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                          {elec.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isComplete) {
                                  setError(`Cannot publish election '${elec.title}'. Candidate configuration is incomplete.`);
                                  return;
                                }
                                handleUpdateStatus(elec.id, 'PUBLISHED');
                              }}
                              className="btn btn-gold"
                              style={{
                                minHeight: '36px',
                                padding: '0.4rem 1rem',
                                fontSize: '0.85rem',
                                opacity: isComplete ? 1 : 0.6,
                                cursor: isComplete ? 'pointer' : 'not-allowed'
                              }}
                              title={isComplete ? "Publish and lock candidate rosters" : "Candidate rosters incomplete"}
                            >
                              <Lock size={14} />
                              <span>Publish & Lock Configuration</span>
                            </button>
                          )}

                          {elec.status === 'PUBLISHED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(elec.id, 'OPEN')}
                                className="btn btn-gold"
                                style={{ minHeight: '36px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                              >
                                <Play size={14} />
                                <span>Open Voting</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(elec.id, 'DRAFT')}
                                className="btn btn-outline"
                                style={{ minHeight: '36px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                              >
                                <span>Return to Draft</span>
                              </button>
                            </>
                          )}

                          {elec.status === 'OPEN' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(elec.id, 'CLOSED')}
                              className="btn btn-outline"
                              style={{ minHeight: '36px', padding: '0.4rem 1rem', fontSize: '0.85rem', borderColor: '#ef4444', color: '#f87171' }}
                            >
                              <Square size={14} />
                              <span>Close Voting</span>
                            </button>
                          )}

                          {elec.status === 'CLOSED' && (
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              Voting concluded. Ballots are permanently sealed and archived.
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteElection(elec.id, elec.title)}
                            className="btn btn-outline"
                            style={{ minHeight: '36px', padding: '0.4rem 0.85rem', fontSize: '0.85rem', borderColor: '#ef4444', color: '#f87171' }}
                            title="Permanently delete election"
                          >
                            <Trash2 size={14} />
                            <span>Delete Election</span>
                          </button>
                        </div>
                      </div>

                      {/* OPEN ELECTIONS: AGGREGATE PARTICIPATION TELEMETRY (Requirement 7 & 8) */}
                      {elec.status === 'OPEN' && (
                        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--color-success)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <BarChart3 size={18} color="var(--color-success)" />
                              <h4 style={{ margin: 0 }}>Active Participation Telemetry</h4>
                            </div>
                            <span className="gold-badge" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', fontSize: '0.75rem' }}>
                              LIVE AGGREGATE STATS
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Eligible Registered Voters</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--text-primary)' }}>
                                {participationStats?.total_eligible_voters ?? voterSummary?.total_registered_voters ?? '—'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Ballots Cast</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--color-soft-gold)' }}>
                                {participationStats?.total_votes_cast ?? 0}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voter Turnout Rate</div>
                              <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--color-success)' }}>
                                {participationStats?.overall_turnout_percentage !== undefined ? `${participationStats.overall_turnout_percentage.toFixed(1)}%` : '0.0%'}
                              </div>
                            </div>

                            <div style={{ background: 'var(--bg-surface-elevated)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Voting Status</div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--color-success)' }}>
                                ACCEPTING BALLOTS
                              </div>
                            </div>
                          </div>

                          {/* Constituency Participation Breakdown Table */}
                          {participationStats?.constituency_breakdown && participationStats.constituency_breakdown.length > 0 && (
                            <div className="table-responsive" style={{ marginTop: '0.5rem' }}>
                              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                <thead>
                                  <tr>
                                    <th>Constituency</th>
                                    <th>Eligible Voters</th>
                                    <th>Ballots Cast</th>
                                    <th>Turnout</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {participationStats.constituency_breakdown.map(stat => (
                                    <tr key={stat.constituency_id}>
                                      <td><strong>{stat.constituency_name}</strong></td>
                                      <td>{stat.eligible_voters}</td>
                                      <td>{stat.votes_cast}</td>
                                      <td>
                                        <span className="gold-badge" style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', fontSize: '0.75rem' }}>
                                          {stat.turnout_percentage?.toFixed(1) || 0}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <strong>Security & Privacy Assurance:</strong> Participation statistics are strictly aggregate counts. Individual voter identities, voter-to-candidate choices, decrypted ballots, and quantum cryptographic keys are mathematically isolated and never accessible in this console.
                          </div>
                        </div>
                      )}

                      {/* CONSTITUENCY CANDIDATE ROSTERS & CONFIGURATION SECTION */}
                      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <h3 style={{ margin: 0 }}>
                              {elec.status === 'DRAFT' ? 'Draft Candidate Configuration & Rosters' : 'Participating Constituency Rosters'}
                            </h3>
                            {elec.status === 'DRAFT' && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Configure candidates per constituency. Every participating constituency must have candidates before publishing.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Incomplete warning for draft */}
                        {elec.status === 'DRAFT' && !isComplete && (
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#f87171',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.6rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <AlertCircle size={16} color="#f87171" />
                            <span>Configuration incomplete. One or more participating constituencies have 0 candidates. Add candidates below to enable publishing.</span>
                          </div>
                        )}

                        {/* Participating Constituencies with Candidate Rosters */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {(elec.participating_constituencies || []).map(c => {
                            const constCands = managingCandidates
                              .filter(cand => cand.constituency_id === c.id && !cand.is_nota)
                              .sort((a, b) => a.ballot_position - b.ballot_position);
                            const isDistComplete = constCands.length > 0;
                            const inputVal = draftCandInputs[c.id] || { name: '', party: '', ballot_position: '' };
                            const nextSuggestedPos = constCands.length + 1;

                            return (
                              <div
                                key={c.id}
                                style={{
                                  background: 'var(--bg-surface)',
                                  border: `1px solid ${isDistComplete ? 'var(--border-subtle)' : 'var(--color-danger)'}`,
                                  borderRadius: 'var(--radius-sm)',
                                  padding: '1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.85rem'
                                }}
                              >
                                {/* Constituency Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <MapPin size={16} color="var(--color-soft-gold)" />
                                    <strong style={{ fontSize: '1rem' }}>{c.name}</strong>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({c.code})</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {elec.status === 'DRAFT' && AP_OFFICIAL_CANDIDATES[c.name] && (
                                      <button
                                        type="button"
                                        onClick={() => handleLoadOfficialCandidatesForDraft(c.id, c.name)}
                                        className="btn btn-outline"
                                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.65rem', minHeight: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                        title={`Load official 2024 candidates for ${c.name}`}
                                      >
                                        <Sparkles size={12} color="var(--color-soft-gold)" />
                                        <span>Load 2024 Candidates</span>
                                      </button>
                                    )}
                                    <span
                                      className="gold-badge"
                                      style={{
                                        borderColor: isDistComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                        color: isDistComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      {isDistComplete ? `${constCands.length} Cand + NOTA (${constCands.length + 1} options)` : 'Incomplete (0 candidates)'}
                                    </span>
                                  </div>
                                </div>

                                {/* Candidate Table */}
                                <div className="table-responsive">
                                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: '50px' }}>Pos</th>
                                        <th>Candidate Name</th>
                                        <th>Party</th>
                                        {elec.status === 'DRAFT' && <th style={{ width: '90px' }}>Actions</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {constCands.map(cand => {
                                        const isEditing = draftEditingCandidateId === cand.id;
                                        if (isEditing && elec.status === 'DRAFT') {
                                          return (
                                            <tr key={cand.id}>
                                              <td>
                                                <input
                                                  type="number"
                                                  min="1"
                                                  style={{ width: '45px', padding: '0.2rem' }}
                                                  value={draftEditingCandidateData.ballot_position}
                                                  onChange={e => setDraftEditingCandidateData({ ...draftEditingCandidateData, ballot_position: e.target.value })}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  className="form-control"
                                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                                  value={draftEditingCandidateData.name}
                                                  onChange={e => setDraftEditingCandidateData({ ...draftEditingCandidateData, name: e.target.value })}
                                                />
                                              </td>
                                              <td>
                                                <input
                                                  type="text"
                                                  className="form-control"
                                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                                  value={draftEditingCandidateData.party}
                                                  onChange={e => setDraftEditingCandidateData({ ...draftEditingCandidateData, party: e.target.value })}
                                                />
                                              </td>
                                              <td>
                                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSaveEditDraftCandidate(cand.id)}
                                                    className="btn btn-gold"
                                                    style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                    title="Save Candidate"
                                                  >
                                                    <Save size={12} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => setDraftEditingCandidateId(null)}
                                                    className="btn btn-outline"
                                                    style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                    title="Cancel Edit"
                                                  >
                                                    <X size={12} />
                                                  </button>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        }

                                        return (
                                          <tr key={cand.id}>
                                            <td>
                                              <strong style={{ color: 'var(--color-soft-gold)' }}>
                                                {cand.ballot_position < 10 ? `0${cand.ballot_position}` : cand.ballot_position}
                                              </strong>
                                            </td>
                                            <td><strong>{cand.name}</strong></td>
                                            <td>{cand.party}</td>
                                            {elec.status === 'DRAFT' && (
                                              <td>
                                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleStartEditDraftCandidate(cand)}
                                                    className="btn btn-outline"
                                                    style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                                    title="Edit Candidate"
                                                  >
                                                    <Edit2 size={12} />
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => handleDeleteDraftCandidate(cand.id)}
                                                    className="btn btn-outline"
                                                    style={{ minHeight: '26px', padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderColor: '#ef4444', color: '#f87171' }}
                                                    title="Remove Candidate"
                                                  >
                                                    <Trash2 size={12} />
                                                  </button>
                                                </div>
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })}

                                      {/* NOTA Row - Strictly positioned last */}
                                      <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                        <td>
                                          <strong style={{ color: 'var(--text-muted)' }}>
                                            {nextSuggestedPos < 10 ? `0${nextSuggestedPos}` : nextSuggestedPos}
                                          </strong>
                                        </td>
                                        <td>
                                          <strong>None of the Above (NOTA)</strong>
                                        </td>
                                        <td>NOTA</td>
                                        {elec.status === 'DRAFT' && (
                                          <td>
                                            <span className="gold-badge" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-secondary)', fontSize: '0.65rem' }}>
                                              NOTA (Last)
                                            </span>
                                          </td>
                                        )}
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* Incomplete notice if 0 candidates in constituency */}
                                {constCands.length === 0 && (
                                  <div style={{ fontSize: '0.8rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)' }}>
                                    Candidate configuration incomplete for {c.name}. Add at least one candidate.
                                  </div>
                                )}

                                {/* Inline Add Candidate Form for Drafts */}
                                {elec.status === 'DRAFT' && (
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) auto',
                                    gap: '0.5rem',
                                    background: 'var(--bg-surface-elevated)',
                                    padding: '0.6rem',
                                    borderRadius: 'var(--radius-sm)',
                                    alignItems: 'center'
                                  }}>
                                    <input
                                      type="text"
                                      className="form-control"
                                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                      placeholder="Candidate Name *"
                                      value={inputVal.name}
                                      onChange={e => setDraftCandInputs({
                                        ...draftCandInputs,
                                        [c.id]: { ...inputVal, name: e.target.value }
                                      })}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCandidateToDraft(c.id); } }}
                                    />

                                    <input
                                      type="text"
                                      className="form-control"
                                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                      placeholder="Party (or 'Independent')"
                                      value={inputVal.party}
                                      onChange={e => setDraftCandInputs({
                                        ...draftCandInputs,
                                        [c.id]: { ...inputVal, party: e.target.value }
                                      })}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCandidateToDraft(c.id); } }}
                                    />

                                    <input
                                      type="number"
                                      min="1"
                                      className="form-control"
                                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                                      placeholder={`Pos (${nextSuggestedPos})`}
                                      value={inputVal.ballot_position}
                                      onChange={e => setDraftCandInputs({
                                        ...draftCandInputs,
                                        [c.id]: { ...inputVal, ballot_position: e.target.value }
                                      })}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCandidateToDraft(c.id); } }}
                                    />

                                    <button
                                      type="button"
                                      onClick={() => handleAddCandidateToDraft(c.id)}
                                      className="btn btn-gold"
                                      style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                                    >
                                      <Plus size={14} />
                                      <span>Add Candidate</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {(!elec.participating_constituencies || elec.participating_constituencies.length === 0) && (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                              No electoral constituencies linked to this election.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Return Button */}
                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          onClick={handleBackToExistingList}
                          className="btn btn-outline"
                          style={{ minHeight: '38px', padding: '0.4rem 1rem' }}
                        >
                          <ArrowLeft size={15} />
                          <span>Back to Existing Elections</span>
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Main Existing Elections List View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Status Filters Bar (Requirement 4) */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: 'var(--bg-surface)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginRight: '0.4rem' }}>Filter by Status:</span>
                      
                      {/* All - neutral/black selected treatment */}
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        className={`btn ${statusFilter === 'ALL' ? 'btn-gold' : 'btn-outline'}`}
                        style={{ minHeight: '28px', padding: '0.2rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        All ({elections.length})
                      </button>

                      {/* Open / Active - green selected treatment */}
                      <button
                        type="button"
                        onClick={() => setStatusFilter('OPEN')}
                        className="btn"
                        style={{
                          minHeight: '28px',
                          padding: '0.2rem 0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: statusFilter === 'OPEN' ? 700 : 600,
                          background: statusFilter === 'OPEN' ? 'var(--color-success)' : 'rgba(34, 197, 94, 0.08)',
                          color: statusFilter === 'OPEN' ? '#ffffff' : 'var(--color-success)',
                          border: `1px solid ${statusFilter === 'OPEN' ? 'var(--color-success)' : 'rgba(34, 197, 94, 0.4)'}`,
                          boxShadow: statusFilter === 'OPEN' ? '0 0 10px rgba(34, 197, 94, 0.35)' : 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: statusFilter === 'OPEN' ? '#ffffff' : 'var(--color-success)',
                          boxShadow: statusFilter === 'OPEN' ? '0 0 4px #ffffff' : '0 0 4px var(--color-success)'
                        }}></span>
                        <span>Open / Active ({elections.filter(e => e.status === 'OPEN').length})</span>
                      </button>

                      {/* Published - neutral/gold treatment */}
                      <button
                        type="button"
                        onClick={() => setStatusFilter('PUBLISHED')}
                        className={`btn ${statusFilter === 'PUBLISHED' ? 'btn-gold' : 'btn-outline'}`}
                        style={{
                          minHeight: '28px',
                          padding: '0.2rem 0.65rem',
                          fontSize: '0.75rem',
                          borderColor: statusFilter === 'PUBLISHED' ? 'var(--color-soft-gold)' : undefined
                        }}
                      >
                        Published ({elections.filter(e => e.status === 'PUBLISHED').length})
                      </button>

                      {/* Draft - neutral/gold treatment */}
                      <button
                        type="button"
                        onClick={() => setStatusFilter('DRAFT')}
                        className={`btn ${statusFilter === 'DRAFT' ? 'btn-gold' : 'btn-outline'}`}
                        style={{
                          minHeight: '28px',
                          padding: '0.2rem 0.65rem',
                          fontSize: '0.75rem',
                          borderColor: statusFilter === 'DRAFT' ? 'var(--color-soft-gold)' : undefined
                        }}
                      >
                        Draft ({elections.filter(e => e.status === 'DRAFT').length})
                      </button>

                      {/* Closed - muted/gray treatment */}
                      <button
                        type="button"
                        onClick={() => setStatusFilter('CLOSED')}
                        className="btn"
                        style={{
                          minHeight: '28px',
                          padding: '0.2rem 0.65rem',
                          fontSize: '0.75rem',
                          background: statusFilter === 'CLOSED' ? 'rgba(255, 255, 255, 0.16)' : 'transparent',
                          color: statusFilter === 'CLOSED' ? '#ffffff' : 'var(--text-muted)',
                          border: `1px solid ${statusFilter === 'CLOSED' ? 'rgba(255, 255, 255, 0.4)' : 'var(--border-subtle)'}`
                        }}
                      >
                        Closed ({elections.filter(e => e.status === 'CLOSED').length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleResetWizard();
                        setSavedElectionSuccess(null);
                        setElectionViewMode('create');
                      }}
                      className="btn btn-gold"
                      style={{ minHeight: '32px', padding: '0.3rem 0.85rem', fontSize: '0.8rem' }}
                    >
                      <Plus size={14} />
                      <span>Create New Election</span>
                    </button>
                  </div>

                  {/* List of Existing Election Summary Cards */}
                  {(() => {
                    const statusOrder: Record<string, number> = {
                      'OPEN': 1,
                      'PUBLISHED': 2,
                      'DRAFT': 3,
                      'CLOSED': 4
                    };

                    const sortedElections = [...elections].sort((a, b) => {
                      const orderA = statusOrder[a.status] || 99;
                      const orderB = statusOrder[b.status] || 99;
                      if (orderA !== orderB) return orderA - orderB;
                      return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime();
                    });

                    const filteredElections = sortedElections.filter(e => {
                      if (statusFilter === 'ALL') return true;
                      return e.status === statusFilter;
                    });

                    if (filteredElections.length === 0) {
                      return (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                          <Vote size={36} color="var(--border-subtle)" style={{ marginBottom: '0.75rem' }} />
                          <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>No elections found</h4>
                          <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.85rem' }}>
                            {statusFilter === 'ALL'
                              ? 'No elections have been registered in the system yet.'
                              : `No elections currently match the status filter '${statusFilter}'.`}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              handleResetWizard();
                              setSavedElectionSuccess(null);
                              setElectionViewMode('create');
                            }}
                            className="btn btn-gold"
                            style={{ minHeight: '36px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                          >
                            <Plus size={14} />
                            <span>Create First Election</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {filteredElections.map(elec => {
                          const isComplete = elec.configuration_status === 'COMPLETE';
                          const statusColor = elec.status === 'OPEN'
                            ? 'var(--color-success)'
                            : elec.status === 'PUBLISHED'
                            ? '#3b82f6'
                            : elec.status === 'DRAFT'
                            ? 'var(--color-soft-gold)'
                            : '#ef4444';

                          return (
                            <div
                              key={elec.id}
                              className="glass-card"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem',
                                border: elec.status === 'OPEN' ? '1px solid var(--color-success)' : '1px solid var(--border-subtle)',
                                background: elec.status === 'OPEN' ? 'rgba(34, 197, 94, 0.03)' : 'var(--bg-surface)'
                              }}
                            >
                              {/* Header: Title & Status */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>{elec.title}</h3>
                                  {elec.description && (
                                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                      {elec.description}
                                    </p>
                                  )}
                                </div>

                                {elec.status === 'OPEN' ? (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    padding: '0.35rem 0.85rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    border: '1px solid var(--color-success)',
                                    color: 'var(--color-success)',
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.25)'
                                  }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', boxShadow: '0 0 8px var(--color-success)' }}></span>
                                    <span>OPEN / ACTIVE</span>
                                  </div>
                                ) : (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.25rem 0.65rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    border: `1px solid ${statusColor}`,
                                    color: statusColor,
                                    background: 'rgba(0,0,0,0.3)'
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></span>
                                    <span>{elec.status}</span>
                                  </div>
                                )}
                              </div>

                              {/* Metadata Grid (Requirement 5) */}
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                gap: '0.75rem',
                                background: 'var(--bg-surface-elevated)',
                                padding: '0.85rem',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.85rem'
                              }}>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>State: </span>
                                  <strong>{elec.state || 'N/A'}</strong>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Election Type: </span>
                                  <strong>{elec.election_type || 'N/A'}</strong>
                                </div>
                                {elec.election_date && (
                                  <div>
                                    <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                                    <strong>{elec.election_date}</strong>
                                  </div>
                                )}
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Constituencies: </span>
                                  <strong>{elec.participating_constituencies?.length || 0}</strong>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Candidates: </span>
                                  <strong>{elec.candidates_count || 0}</strong>
                                </div>
                                <div>
                                  <span style={{ color: 'var(--text-muted)' }}>Configuration: </span>
                                  <span
                                    className="gold-badge"
                                    style={{
                                      borderColor: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                      color: isComplete ? 'var(--color-success)' : 'var(--color-danger)',
                                      fontSize: '0.75rem',
                                      marginLeft: '0.25rem'
                                    }}
                                  >
                                    {elec.configuration_status || (isComplete ? 'COMPLETE' : 'INCOMPLETE')}
                                  </span>
                                </div>
                              </div>

                              {/* Incomplete notice for draft */}
                              {elec.status === 'DRAFT' && !isComplete && (
                                <div style={{
                                  fontSize: '0.8rem',
                                  color: '#f87171',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  padding: '0.5rem 0.75rem',
                                  borderRadius: 'var(--radius-sm)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <AlertCircle size={15} color="#f87171" />
                                  <span>Configuration incomplete. One or more participating constituencies require candidate rosters before publishing.</span>
                                </div>
                              )}

                              {/* Lifecycle Action Buttons (Requirements 5, 6, 7) */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  {elec.status === 'DRAFT' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleInspectElection(elec.id)}
                                        className="btn btn-gold"
                                        style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                                      >
                                        <Edit2 size={13} />
                                        <span>{isComplete ? 'Configure' : 'Continue Configuration'}</span>
                                      </button>

                                      {isComplete && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateStatus(elec.id, 'PUBLISHED')}
                                          className="btn btn-outline"
                                          style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem', borderColor: '#3b82f6', color: '#60a5fa' }}
                                          title="Lock configuration and prepare for balloting"
                                        >
                                          <Lock size={13} />
                                          <span>Publish & Lock</span>
                                        </button>
                                      )}
                                    </>
                                  ) : elec.status === 'PUBLISHED' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleInspectElection(elec.id)}
                                        className="btn btn-gold"
                                        style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                                      >
                                        <span>View / Manage</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(elec.id, 'OPEN')}
                                        className="btn btn-outline"
                                        style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                                      >
                                        <Play size={13} />
                                        <span>Open Voting</span>
                                      </button>
                                    </>
                                  ) : elec.status === 'OPEN' ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleInspectElection(elec.id)}
                                        className="btn btn-gold"
                                        style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                                      >
                                        <span>View / Manage</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateStatus(elec.id, 'CLOSED')}
                                        className="btn btn-outline"
                                        style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#f87171' }}
                                      >
                                        <Square size={13} />
                                        <span>Close Voting</span>
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleInspectElection(elec.id)}
                                      className="btn btn-outline"
                                      style={{ minHeight: '34px', padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}
                                    >
                                      <span>View</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteElection(elec.id, elec.title)}
                                    className="btn btn-outline"
                                    style={{ minHeight: '34px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#f87171' }}
                                    title="Permanently delete election"
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>

                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ID: <code style={{ fontSize: '0.75rem' }}>{elec.id.substring(0, 8)}...</code>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CONSTITUENCIES */}
      {activeTab === 'constituencies' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          <div className="glass-card">
            <h3>Add New Electoral Constituency</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Define a constituency that can participate across elections.
            </p>
            <form onSubmit={handleCreateConstituency}>
              <div className="form-group">
                <label className="form-label">Constituency Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newConstituency.name}
                  onChange={e => setNewConstituency({ ...newConstituency, name: e.target.value })}
                  placeholder="e.g. Ward-4"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Constituency Code *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newConstituency.code}
                  onChange={e => setNewConstituency({ ...newConstituency, code: e.target.value })}
                  placeholder="e.g. W4"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">State / Region</label>
                <input
                  type="text"
                  className="form-control"
                  value={newConstituency.state}
                  onChange={e => setNewConstituency({ ...newConstituency, state: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-gold" style={{ width: '100%', marginTop: '0.5rem' }}>
                <Plus size={16} />
                <span>Create Constituency</span>
              </button>
            </form>
          </div>

          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Constituencies in Election</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Selected: <strong>{selectedElection?.title || 'None'}</strong> ({selectedElection?.status})
                </div>
              </div>
            </div>

            {selectedElection?.status === 'DRAFT' && (
              <div style={{ marginBottom: '1.25rem', padding: '0.85rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Link Available Constituency to Election:</div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {constituencies
                    .filter(c => !selectedElection?.participating_constituencies?.some(pc => pc.id === c.id))
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleAddConstituencyToElection(c.id)}
                        className="btn btn-outline"
                        style={{ minHeight: '34px', padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        <Plus size={12} />
                        <span>Add {c.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Constituency Name</th>
                    <th>Code</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedElection?.participating_constituencies?.map((pc) => (
                    <tr key={pc.id}>
                      <td><strong>{pc.name}</strong></td>
                      <td>{pc.code}</td>
                      <td>{pc.state}</td>
                      <td>
                        <button
                          onClick={() => {
                            setSelectedConstituencyId(pc.id);
                            setActiveTab('candidates');
                          }}
                          className="btn btn-outline"
                          style={{ minHeight: '30px', padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
                        >
                          View Ballot Roster <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!selectedElection?.participating_constituencies || selectedElection.participating_constituencies.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No constituencies linked to this election yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CANDIDATE ROSTERS */}
      {activeTab === 'candidates' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          {/* Add Candidate Form */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Add Candidate to Ballot Unit</h3>
              {selectedElection?.status !== 'DRAFT' && (
                <span className="gold-badge" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
                  <Lock size={12} /> Roster Locked ({selectedElection?.status})
                </span>
              )}
            </div>

            <form onSubmit={handleCreateCandidate}>
              <div className="form-group">
                <label className="form-label">Select Election</label>
                <select
                  className="form-control"
                  value={selectedElectionId}
                  onChange={e => setSelectedElectionId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Election --</option>
                  {elections.map(e => (
                    <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Select Constituency</label>
                <select
                  className="form-control"
                  value={selectedConstituencyId}
                  onChange={e => setSelectedConstituencyId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Constituency --</option>
                  {selectedElection?.participating_constituencies?.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Candidate Full Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCandidate.name}
                  onChange={e => setNewCandidate({ ...newCandidate, name: e.target.value })}
                  placeholder="e.g. Dr. Sarah Rao"
                  disabled={selectedElection?.status !== 'DRAFT'}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Political Party Affiliation *</label>
                <input
                  type="text"
                  className="form-control"
                  value={newCandidate.party}
                  onChange={e => setNewCandidate({ ...newCandidate, party: e.target.value })}
                  placeholder="e.g. Progressive Coalition (or 'Independent')"
                  disabled={selectedElection?.status !== 'DRAFT'}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ballot Display Position (Optional)</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  value={newCandidate.ballot_position}
                  onChange={e => setNewCandidate({ ...newCandidate, ballot_position: e.target.value })}
                  placeholder="Leave blank for automatic next position"
                  disabled={selectedElection?.status !== 'DRAFT'}
                />
              </div>

              <button
                type="submit"
                className="btn btn-gold"
                style={{ width: '100%', marginTop: '0.5rem' }}
                disabled={selectedElection?.status !== 'DRAFT'}
              >
                <Plus size={16} />
                <span>Add Candidate to Constituency</span>
              </button>
            </form>
          </div>

          {/* EVM-Inspired Candidate Ballot List */}
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>EVM Balloting Unit Roster</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Ordered candidate sequence for voters in this constituency. NOTA is strictly placed last.
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Pos</th>
                    <th>Candidate Name</th>
                    <th>Party Affiliation</th>
                    <th>Type</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} style={{ background: c.is_nota ? 'rgba(255,255,255,0.03)' : undefined }}>
                      <td>
                        <strong style={{ fontSize: '1rem', color: c.is_nota ? 'var(--text-muted)' : 'var(--color-soft-gold)' }}>
                          {c.ballot_position < 10 ? `0${c.ballot_position}` : c.ballot_position}
                        </strong>
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                      </td>
                      <td>{c.party}</td>
                      <td>
                        {c.is_nota ? (
                          <span className="gold-badge" style={{ borderColor: 'var(--text-muted)', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                            SPECIAL (NOTA)
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Standard Candidate</span>
                        )}
                      </td>
                      <td>
                        {c.is_nota ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fixed Last</span>
                        ) : selectedElection?.status === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidate(c.id)}
                            className="btn btn-outline"
                            style={{ minHeight: '26px', padding: '0.15rem 0.5rem', fontSize: '0.7rem', borderColor: '#ef4444', color: '#f87171' }}
                            title="Remove candidate from draft roster"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Lock size={12} /> Locked
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No candidates registered for this constituency yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PARTICIPATION TELEMETRY */}
      {activeTab === 'participation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Privacy Banner */}
          <div style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <ShieldAlert size={24} color="var(--color-soft-gold)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                Cryptographic Privacy Architecture Notice
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Voter participation is stored separately from the encrypted ballot. The system does not store a voter-to-candidate mapping.
                Admin views aggregate turnout telemetry only; plaintext ballots and cryptographic keys are strictly inaccessible.
              </div>
            </div>
          </div>

          {/* Election Selector */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div className="form-group" style={{ maxWidth: '400px', margin: 0 }}>
              <label className="form-label">Select Election for Turnout Telemetry</label>
              <select
                className="form-control"
                value={selectedElectionId}
                onChange={e => setSelectedElectionId(e.target.value)}
              >
                {elections.map(e => (
                  <option key={e.id} value={e.id}>{e.title} ({e.status})</option>
                ))}
              </select>
            </div>
          </div>

          {participationStats && (
            <>
              {/* Stat summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Eligible Registered Voters</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {participationStats.total_eligible_voters}
                  </div>
                </div>

                <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Encrypted Ballots Cast</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)' }}>
                    {participationStats.total_votes_cast}
                  </div>
                </div>

                <div className="glass-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Aggregate Voter Turnout</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-soft-gold)' }}>
                    {participationStats.overall_turnout_percentage}%
                  </div>
                </div>
              </div>

              {/* Constituency breakdown table */}
              <div className="glass-card">
                <h3>Constituency-Wise Aggregate Participation</h3>
                <div className="table-responsive" style={{ marginTop: '1rem' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Constituency</th>
                        <th>Eligible Voters</th>
                        <th>Ballots Cast</th>
                        <th>Turnout %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participationStats.constituency_breakdown.map((cb) => (
                        <tr key={cb.constituency_id}>
                          <td><strong>{cb.constituency_name}</strong></td>
                          <td>{cb.eligible_voters}</td>
                          <td>{cb.votes_cast}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ flex: 1, background: 'var(--bg-surface)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(cb.turnout_percentage, 100)}%`, background: 'var(--color-soft-gold)', height: '100%' }}></div>
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{cb.turnout_percentage}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 5: PRE-PROVISIONED VOTER REGISTRY (READ-ONLY) */}
      {activeTab === 'voters' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <Users size={24} color="var(--color-soft-gold)" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Pre-Provisioned Electoral Registry (Read-Only)</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Voter records are pre-provisioned from the external electoral roll for this prototype.
                The administration console is restricted from creating, editing, or managing voter identities or credentials.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Total Pre-Registered Voters</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{voterSummary.total_registered_voters || voters.length}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Active Verified Status</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-success)' }}>{voterSummary.active_voters || voters.length}</div>
            </div>
            <div className="glass-card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Participating Constituencies</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{Object.keys(voterSummary.constituency_counts || {}).length}</div>
            </div>
          </div>

          <div className="glass-card">
            <h3>Registered Voters Roster</h3>
            <div className="table-responsive" style={{ marginTop: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Voter ID</th>
                    <th>Full Name</th>
                    <th>Assigned Constituency</th>
                    <th>Masked Mobile</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.voter_id || v.username}</strong></td>
                      <td>{v.full_name || v.username}</td>
                      <td>{v.constituency}</td>
                      <td><code style={{ fontSize: '0.85rem' }}>{v.masked_mobile || '******43101'}</code></td>
                      <td>
                        <span className="gold-badge" style={{ fontSize: '0.7rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
                          ELIGIBLE
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOG VIEWER */}
      {activeTab === 'audit' && (
        <div className="glass-card">
          <div style={{ marginBottom: '1rem' }}>
            <h3>Sanitized Audit Log Trail</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Cryptographic separation guarantee: <code>VOTE_CAST</code> entries have <code>user_id == null</code> and contain zero candidate choices or cryptographic key material.
            </p>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp (UTC)</th>
                  <th>Action</th>
                  <th>User ID Linkage</th>
                  <th>Sanitized Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{log.created_at}</td>
                    <td>
                      <span className="gold-badge" style={{
                        background: log.action === 'VOTE_CAST' ? 'var(--color-success-bg)' : undefined,
                        color: log.action === 'VOTE_CAST' ? 'var(--color-success)' : undefined,
                        borderColor: log.action === 'VOTE_CAST' ? 'var(--color-success)' : undefined,
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.user_id ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{log.user_id.slice(0, 8)}...</span>
                      ) : (
                        <span style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '0.85rem' }}>
                          NULL (Separated)
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>
                      <pre style={{ margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(log.details)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: QUANTUM LAB */}
      {activeTab === 'quantum' && (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <h3>Qiskit BB84 Simulation Workbench</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Test and demonstrate quantum key distribution parameters, QBER monitoring, and intercept-resend eavesdropping rejection.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-surface-elevated)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Eavesdropper (Eve) Intercept-Resend Simulation</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  When enabled, Eve's intercept-resend attack induces ~25% QBER in the sifted basis.
                  QBER above the configured threshold (&le; 11%) causes the BB84 key-establishment attempt to be rejected.
                </div>
              </div>

              <button
                onClick={handleToggleSimulation}
                className={`btn ${simulationConfig.simulate_eavesdropping ? 'btn-danger' : 'btn-gold'}`}
                style={{ minHeight: '44px', padding: '0.5rem 1.5rem' }}
              >
                {simulationConfig.simulate_eavesdropping ? 'Disable Eve Eavesdropping' : 'Enable Eve Eavesdropping'}
              </button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)'
            }}>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Simulation Qubit Batch</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{simulationConfig.qubit_count || 800} Qubits</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required Usable Bits</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>256 Bits (AES-256)</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>QBER Threshold</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>&le; 11.00%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Status</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: simulationConfig.simulate_eavesdropping ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  {simulationConfig.simulate_eavesdropping ? 'Eavesdropping Active' : 'Normal / Clean Channel'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
