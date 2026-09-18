import axios from 'axios';

const envApiUrl = import.meta.env.VITE_API_BASE_URL;
if (!envApiUrl) {
  throw new Error(
    'Configuration Error: VITE_API_BASE_URL environment variable is missing. ' +
    'Please define VITE_API_BASE_URL in your frontend .env configuration.'
  );
}

export const API_BASE_URL = envApiUrl;

export interface UserProfile {
  id: string;
  username: string;
  role: 'ADMIN' | 'VOTER';
  constituency: string;
  voter_id?: string;
  full_name?: string;
  is_active?: boolean;
  masked_mobile?: string;
  created_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface VoterInitiateRequest {
  voter_id: string;
}

export interface VoterInitiateResponse {
  message: string;
  masked_mobile: string;
  stage: string;
  stage_token: string;
}

export interface VoterVerifyOtpRequest {
  stage_token: string;
  otp: string;
}

export interface VoterVerifyOtpResponse {
  message: string;
  stage: string;
  stage_token: string;
}

export interface VoterResendOtpRequest {
  stage_token: string;
}

export interface VoterResendOtpResponse {
  message: string;
  masked_mobile?: string;
}

export interface VoterVerifyIdentityRequest {
  stage_token: string;
  is_demo_fallback?: boolean;
  frame_data?: string;
}

export interface VoterVerifyIdentityResponse {
  message: string;
  token: string;
  user: UserProfile;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface Constituency {
  id: string;
  name: string;
  name_en?: string;
  name_te?: string;
  name_hi?: string;
  code: string;
  state: string;
  is_active: boolean;
  created_at?: string;
}

export interface Election {
  id: string;
  title: string;
  title_en?: string;
  title_te?: string;
  title_hi?: string;
  description: string;
  description_en?: string;
  description_te?: string;
  description_hi?: string;
  election_type: string;
  election_type_en?: string;
  election_type_te?: string;
  election_type_hi?: string;
  state: string;
  election_date: string | null;
  voting_open_at: string | null;
  voting_close_at: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED';
  is_active: boolean;
  created_at: string;
  participating_constituencies?: Constituency[];
}

export interface Candidate {
  id: string;
  election_id: string;
  constituency_id: string;
  constituency: string;
  name: string;
  name_en?: string;
  name_te?: string;
  name_hi?: string;
  party: string;
  party_en?: string;
  party_te?: string;
  party_hi?: string;
  ballot_position: number;
  is_active: boolean;
  is_nota: boolean;
  created_at?: string;
}

export interface VoterElectionInfoResponse {
  election: Election | null;
  voter_constituency: string;
  voter_constituency_info?: Partial<Constituency>;
  has_voted: boolean;
  voted_at: string | null;
  eligible_candidates: Candidate[];
  message?: string;
}

export interface CastVoteRequest {
  election_id: string;
  candidate_id: string;
}

export interface QuantumTelemetry {
  qkd_protocol: string;
  qber: number;
  qber_percentage: number;
  sifted_bits: number;
  usable_bits: number;
  eavesdropping_simulated: boolean;
  channel_status: string;
}

export interface CastVoteResponse {
  success: boolean;
  message: string;
  telemetry: QuantumTelemetry;
}

export interface ConstituencyParticipation {
  constituency_id: string;
  constituency_name: string;
  eligible_voters: number;
  votes_cast: number;
  turnout_percentage: number;
}

export interface ParticipationStatsResponse {
  election_id: string;
  election_title: string;
  status: string;
  is_active: boolean;
  total_eligible_voters: number;
  total_votes_cast: number;
  overall_turnout_percentage: number;
  constituency_breakdown: ConstituencyParticipation[];
  privacy_guarantee: string;
}

export interface VoterRegistryResponse {
  voters: UserProfile[];
  summary: {
    total_registered_voters: number;
    active_voters: number;
    constituency_counts: Record<string, number>;
  };
}

export interface ApiErrorResponse {
  error: string;
  message: string;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const api = {
  // Auth
  login: (credentials: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', credentials),
  loginAdmin: (credentials: AdminLoginRequest) =>
    apiClient.post<LoginResponse>('/auth/admin/login', credentials),
  initiateVoter: (data: VoterInitiateRequest) =>
    apiClient.post<VoterInitiateResponse>('/auth/voter/initiate', data),
  verifyVoterOtp: (data: VoterVerifyOtpRequest) =>
    apiClient.post<VoterVerifyOtpResponse>('/auth/voter/verify-otp', data),
  resendVoterOtp: (data: VoterResendOtpRequest) =>
    apiClient.post<VoterResendOtpResponse>('/auth/voter/resend-otp', data),
  verifyVoterIdentity: (data: VoterVerifyIdentityRequest) =>
    apiClient.post<VoterVerifyIdentityResponse>('/auth/voter/verify-identity', data),
  getMe: () => apiClient.get<{ user: UserProfile }>('/auth/me'),

  // Admin Read-Only Voter Registry
  getVoters: () => apiClient.get<VoterRegistryResponse>('/admin/voters'),

  // Admin Constituency Management
  getConstituencies: () => apiClient.get<{ constituencies: Constituency[] }>('/admin/constituencies'),
  createConstituency: (data: { name: string; code: string; state?: string }) =>
    apiClient.post<{ message: string; constituency: Constituency }>('/admin/constituencies', data),

  // Admin Election Management
  createElection: (data: {
    title: string;
    description?: string;
    election_type?: string;
    state?: string;
    election_date?: string;
    voting_open_at?: string;
    voting_close_at?: string;
    constituency_ids?: string[];
  }) => apiClient.post<{ message: string; election: Election }>('/admin/elections', data),
  getElections: () => apiClient.get<{ elections: Election[] }>('/admin/elections'),
  getElection: (id: string) => apiClient.get<{ election: Election }>(`/admin/elections/${id}`),
  updateElection: (id: string, data: Partial<Election>) =>
    apiClient.patch<{ message: string; election: Election }>(`/admin/elections/${id}`, data),
  updateElectionStatus: (id: string, status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'CLOSED') =>
    apiClient.patch<{ message: string; election: Election }>(`/admin/elections/${id}/status`, { status }),
  addElectionConstituency: (electionId: string, constituencyId: string) =>
    apiClient.post(`/admin/elections/${electionId}/constituencies`, { constituency_id: constituencyId }),

  // Admin Candidate Management
  createCandidate: (data: {
    election_id: string;
    constituency_id: string;
    name: string;
    party: string;
    ballot_position?: number;
  }) => apiClient.post<{ message: string; candidate: Candidate }>('/admin/candidates', data),
  getCandidates: (params?: { election_id?: string; constituency_id?: string }) =>
    apiClient.get<{ candidates: Candidate[] }>('/admin/candidates', { params }),

  // Admin Participation Telemetry & Audit
  getParticipationStats: (electionId: string) =>
    apiClient.get<ParticipationStatsResponse>(`/admin/elections/${electionId}/participation-stats`),
  getAuditLogs: () => apiClient.get<{ audit_logs: any[] }>('/admin/audit-logs'),
  getSimulationConfig: () => apiClient.get('/admin/simulation-config'),
  updateSimulationConfig: (data: { simulate_eavesdropping?: boolean; qubit_count?: number }) =>
    apiClient.post('/admin/simulation-config', data),

  // Voter Balloting
  getVoterElectionInfo: () => apiClient.get<VoterElectionInfoResponse>('/voter/election-info'),
  castVote: (election_id: string, candidate_id: string) =>
    apiClient.post<CastVoteResponse>('/voter/cast-vote', { election_id, candidate_id } as CastVoteRequest),

  // System Health
  getHealth: () => apiClient.get('/health'),
};

export default apiClient;
