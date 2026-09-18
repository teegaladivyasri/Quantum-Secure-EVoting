from flask import Blueprint, request, jsonify, g
from backend.models.user import User
from backend.models.election import Election
from backend.models.candidate import Candidate
from backend.models.participation import ParticipationRecord
from backend.services.voting_service import cast_voter_ballot, VotingError
from backend.middleware.auth_guard import require_role

voter_bp = Blueprint("voter_bp", __name__, url_prefix="/api/v1/voter")

@voter_bp.route("/election-info", methods=["GET"])
@require_role(["VOTER"])
def get_voter_election_info():
    # Constituency is derived strictly from the authenticated voter record
    voter = User.query.filter_by(id=g.current_user["id"]).first()
    if not voter:
        return jsonify({"error": "NOT_FOUND", "message": "Voter account not found."}), 404

    # Backend is authoritative: Only elections in OPEN status accept voting
    election_id = request.args.get("election_id")
    if election_id:
        active_election = Election.query.filter_by(id=election_id, status="OPEN").first()
    else:
        active_election = Election.query.filter_by(status="OPEN").order_by(Election.created_at.desc()).first()

    if not active_election:
        return jsonify({
            "election": None,
            "voter_constituency": voter.constituency,
            "has_voted": False,
            "eligible_candidates": [],
            "message": "No active election is currently running."
        }), 200

    # Check participation record
    participation = ParticipationRecord.query.filter_by(
        voter_id=voter.id, 
        election_id=active_election.id
    ).first()
    has_voted = participation.has_voted if participation else False

    # Retrieve only active candidates registered in the voter's assigned constituency.
    # Deterministic ordering: standard candidates sorted by ballot_position, with NOTA strictly last.
    eligible_candidates = Candidate.query.filter_by(
        election_id=active_election.id,
        constituency=voter.constituency,
        is_active=True
    ).order_by(Candidate.is_nota.asc(), Candidate.ballot_position.asc()).all()

    from backend.models.constituency import Constituency
    const_obj = Constituency.query.filter_by(name=voter.constituency).first()
    voter_constituency_info = const_obj.to_dict() if const_obj else {
        "name": voter.constituency,
        "name_en": voter.constituency,
        "name_te": "వార్డు-1" if "1" in voter.constituency else ("వార్డు-2" if "2" in voter.constituency else "వార్డు-3"),
        "name_hi": "वार्ड-1" if "1" in voter.constituency else ("वार्ड-2" if "2" in voter.constituency else "वार्ड-3")
    }

    return jsonify({
        "election": active_election.to_dict(),
        "voter_constituency": voter.constituency,
        "voter_constituency_info": voter_constituency_info,
        "has_voted": has_voted,
        "voted_at": participation.voted_at.isoformat() if (participation and participation.voted_at) else None,
        "eligible_candidates": [c.to_dict() for c in eligible_candidates]
    }), 200

@voter_bp.route("/cast-vote", methods=["POST"])
@require_role(["VOTER"])
def cast_vote():
    voter_id = g.current_user["id"]
    data = request.get_json() or {}
    election_id = data.get("election_id")
    candidate_id = data.get("candidate_id")

    if not election_id or not candidate_id:
        return jsonify({
            "error": "VALIDATION_ERROR", 
            "message": "Both 'election_id' and 'candidate_id' are required."
        }), 400

    try:
        result = cast_voter_ballot(
            voter_id=voter_id,
            election_id=election_id,
            candidate_id=candidate_id
        )
        return jsonify(result), 200
    except VotingError as e:
        return jsonify({"error": "VOTING_ERROR", "message": e.message}), e.status_code
    except Exception as e:
        return jsonify({"error": "SERVER_ERROR", "message": f"Voting processing failed: {str(e)}"}), 500
