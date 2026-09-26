import { Link } from 'react-router-dom'
import Logo from './Logo.jsx'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__about">
            <Logo />
            <p>
              Dawa.ae is a drug repurposing platform that puts a variational autoencoder and a
              5.3-million-edge biomedical knowledge graph behind a clinical search box, so that
              wet-lab researchers can rank candidates without writing a line of Python.
            </p>
            <p className="tiny muted">
              Research use only. Predictions are hypotheses for further study, not medical advice and
              not a substitute for clinical evidence.
            </p>
          </div>

          <div>
            <div className="eyebrow footer__heading">Platform</div>
            <ul className="footer__list">
              <li><Link to="/">Search</Link></li>
              <li><Link to="/database">Database</Link></li>
              <li><Link to="/model">Model card</Link></li>
              <li><Link to="/docs">API docs</Link></li>
              <li><Link to="/history">Query history</Link></li>
            </ul>
          </div>

          <div>
            <div className="eyebrow footer__heading">Project</div>
            <ul className="footer__list">
              <li>College of Computing and Informatics, University of Sharjah</li>
              <li>Ryan Taha · Andreh Tabbah · Fahad Qutaiba · Omar Afaneh</li>
              <li>Supervisor: Dr. Manar Abu Talib</li>
              <li className="muted">Aligned with UAE Vision 2031 and the National AI Strategy 2031</li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Dawa.ae · University of Sharjah</span>
          <span>Data: DrugBank, ChEMBL, CTD, Open Targets, DGIdb, STRING, SIDER, DSigDB, LINCS, e-Drug3D, MeSH</span>
        </div>
      </div>
    </footer>
  )
}
