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
  ArrowRight
} from 'lucide-react';

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

  // Form states
  const [newElection, setNewElection] = useState({
    title: '',
    description: '',
    election_type: 'State Legislative Assembly',
    state: 'Example State',
    election_date: '',
    voting_open_at: '',
    voting_close_at: '',
    constituency_ids: [] as string[]
  });

  const [newConstituency, setNewConstituency] = useState({
    name: '',
    code: '',
    state: 'Example State'
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

  // --- Handlers ---
  const handleCreateElection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.createElection({
        title: newElection.title,
        description: newElection.description || undefined,
        election_type: newElection.election_type,
        state: newElection.state,
        election_date: newElection.election_date || undefined,
        voting_open_at: newElection.voting_open_at ? new Date(newElection.voting_open_at).toISOString() : undefined,
        voting_close_at: newElection.voting_close_at ? new Date(newElection.voting_close_at).toISOString() : undefined,
        constituency_ids: newElection.constituency_ids
      });
      setMessage(`Election '${res.data.election.title}' created in DRAFT status!`);
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
      loadAllData();
      setSelectedElectionId(res.data.election.id);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create election.');
    }
  };

  const handleUpdateStatus = async (electionId: string, status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED') => {
    setError('');
    setMessage('');
    try {
      const res = await api.updateElectionStatus(electionId, status);
      setMessage(`Election status successfully transitioned to ${res.data.election.status}.`);
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to transition election status.');
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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add candidate.');
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          {/* Create Election Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Plus size={20} color="var(--color-soft-gold)" />
              <h3 style={{ margin: 0 }}>Configure New Election</h3>
            </div>
            <form onSubmit={handleCreateElection}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

              {/* Participating constituencies selection */}
              <div className="form-group">
                <label className="form-label">Participating Constituencies</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)' }}>
                  {constituencies.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newElection.constituency_ids.includes(c.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            setNewElection({ ...newElection, constituency_ids: [...newElection.constituency_ids, c.id] });
                          } else {
                            setNewElection({ ...newElection, constituency_ids: newElection.constituency_ids.filter(id => id !== c.id) });
                          }
                        }}
                      />
                      <span>{c.name} ({c.code})</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Initial status will be <strong>DRAFT</strong>. You can configure candidates before publishing.
              </div>

              <button type="submit" className="btn btn-gold" style={{ width: '100%' }}>
                <Plus size={16} />
                <span>Create Draft Election</span>
              </button>
            </form>
          </div>

          {/* Election List & Lifecycle Control Card */}
          <div className="glass-card">
            <h3>Configured Elections</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {elections.map((elec) => {
                const isCurrent = elec.id === selectedElectionId;
                const statusColor = elec.status === 'OPEN' 
                  ? 'var(--color-success)' 
                  : elec.status === 'PUBLISHED' 
                  ? '#3b82f6' 
                  : elec.status === 'CLOSED' 
                  ? '#ef4444' 
                  : 'var(--text-muted)';

                return (
                  <div key={elec.id} style={{
                    background: isCurrent ? 'var(--bg-surface-elevated)' : 'var(--bg-surface)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${isCurrent ? 'var(--color-soft-gold)' : 'var(--border-subtle)'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{elec.title}</h4>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          {elec.election_type} • {elec.state}
                        </div>
                      </div>

                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        border: `1px solid ${statusColor}`,
                        color: statusColor,
                        background: 'rgba(0,0,0,0.4)'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }}></span>
                        <span>{elec.status}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {elec.description || 'No description provided.'}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                      {elec.election_date && (
                        <div><Calendar size={13} style={{ display: 'inline', marginRight: '3px' }} /> Date: {elec.election_date}</div>
                      )}
                      <div>
                        Participating Districts: {elec.participating_constituencies?.length || 0}
                      </div>
                    </div>

                    {/* Lifecycle Actions */}
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <button
                        onClick={() => setSelectedElectionId(elec.id)}
                        className={`btn ${isCurrent ? 'btn-gold' : 'btn-outline'}`}
                        style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                      >
                        {isCurrent ? 'Active In Console' : 'Select for Management'}
                      </button>

                      {elec.status === 'DRAFT' && (
                        <button
                          onClick={() => handleUpdateStatus(elec.id, 'PUBLISHED')}
                          className="btn btn-outline"
                          style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderColor: '#3b82f6', color: '#60a5fa' }}
                          title="Lock configuration and prepare for balloting"
                        >
                          <Lock size={13} />
                          <span>Publish & Lock</span>
                        </button>
                      )}

                      {elec.status === 'PUBLISHED' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(elec.id, 'OPEN')}
                            className="btn btn-outline"
                            style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                            title="Begin voting period"
                          >
                            <Play size={13} />
                            <span>Open Voting</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(elec.id, 'DRAFT')}
                            className="btn btn-outline"
                            style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}
                            title="Return to draft to allow edits"
                          >
                            <span>Return to Draft</span>
                          </button>
                        </>
                      )}

                      {elec.status === 'OPEN' && (
                        <button
                          onClick={() => handleUpdateStatus(elec.id, 'CLOSED')}
                          className="btn btn-outline"
                          style={{ minHeight: '34px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', borderColor: '#ef4444', color: '#f87171' }}
                          title="Permanently stop accepting votes"
                        >
                          <Square size={13} />
                          <span>Close Voting</span>
                        </button>
                      )}

                      {elec.status === 'CLOSED' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                          Voting Concluded (Final)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSTITUENCIES */}
      {activeTab === 'constituencies' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          <div className="glass-card">
            <h3>Add New Electoral District</h3>
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
                    <th>District Name</th>
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
                  Ordered candidate sequence for voters in this district. NOTA is strictly placed last.
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
                    </tr>
                  ))}
                  {candidates.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
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
                <h3>District-Wise Aggregate Participation</h3>
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
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Participating Districts</div>
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
