export default function AlertBanner({ alerts }) {
  if (!alerts?.length) {
    return null;
  }

  return (
    <section className="alert-strip">
      {alerts.map((alert) => (
        <div key={alert.code} className={`alert-item ${alert.level}`}>
          {alert.message}
        </div>
      ))}
    </section>
  );
}
