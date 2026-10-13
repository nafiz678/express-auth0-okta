import { Link, useLocation } from 'react-router';
import { ArrowIcon, Brand } from '../components/ui';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="page">
      <header className="topbar">
        <Brand />
      </header>
      <main className="lost">
        <p className="eyebrow">404</p>
        <h1>
          No door at <em>{pathname}</em>
        </h1>
        <p className="lede">This address doesn't lead anywhere. Head back and we'll point you the right way.</p>
        <Link className="btn btn-primary" to="/">
          Back to the entrance <ArrowIcon />
        </Link>
      </main>
    </div>
  );
}
