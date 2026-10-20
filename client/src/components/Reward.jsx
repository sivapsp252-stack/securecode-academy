export default function Reward({ reward }) {
  if (!reward) return null;
  if (reward.alreadyCompleted) return <div className="reward muted">Already completed - no extra XP this time.</div>;
  return (
    <div className="reward" role="status">
      <strong>+{reward.xpGained} XP</strong>
      {reward.leveledUp && <span> · Level up! You are now level {reward.level}</span>}
      <span> · 🔥 {reward.streak}-day streak</span>
      {reward.newBadges?.map((b) => <div key={b.slug} className="newbadge">{b.icon} Badge unlocked: <b>{b.name}</b> - {b.description}</div>)}
    </div>
  );
}
