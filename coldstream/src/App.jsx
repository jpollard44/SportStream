import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Campaigns from './pages/Campaigns.jsx'
import CampaignNew from './pages/CampaignNew.jsx'
import CampaignDetail from './pages/CampaignDetail.jsx'
import Leads from './pages/Leads.jsx'
import Unibox from './pages/Unibox.jsx'
import Accounts from './pages/Accounts.jsx'
import Warmup from './pages/Warmup.jsx'
import Analytics from './pages/Analytics.jsx'
import AiWriter from './pages/AiWriter.jsx'
import Settings from './pages/Settings.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="campaigns/new" element={<CampaignNew />} />
          <Route path="campaigns/:id" element={<CampaignDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="unibox" element={<Unibox />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="warmup" element={<Warmup />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="writer" element={<AiWriter />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
