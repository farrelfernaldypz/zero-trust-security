import Icon from './Icon.jsx';

export default function ConfirmDialog({ title, message, confirmLabel = 'Ya, lanjutkan', busy = false, onConfirm, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="confirm-icon"><Icon name="shield" size={22} /></div>
        <button className="icon-button confirm-close" type="button" aria-label="Tutup dialog" onClick={onClose} disabled={busy}>
          <Icon name="close" />
        </button>
        <h2 id="confirm-title">{title}</h2>
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="button button-secondary" type="button" onClick={onClose} disabled={busy}>Batal</button>
          <button className="button button-primary" type="button" onClick={onConfirm} disabled={busy}>
            {busy ? <span className="spinner spinner-light" /> : null}
            {busy ? 'Memproses…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
