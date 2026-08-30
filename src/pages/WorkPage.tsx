import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BottomNav } from '@/components/layout/BottomNav';
import { useProfile } from '@/hooks/useProfile';
import type { WorkContext } from '@/types';

function splitList(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function WorkPage() {
  const { profile, updateProfile } = useProfile();
  const wc = profile?.workContext;
  const [profession, setProfession] = useState(wc?.profession || profile?.profession || '');
  const [tools, setTools] = useState((wc?.tools || []).join(', '));
  const [tasks, setTasks] = useState((wc?.tasks || []).join(', '));
  const [equipment, setEquipment] = useState((wc?.equipment || []).join(', '));
  const [colleagues, setColleagues] = useState((wc?.colleagues || []).join(', '));
  const [situations, setSituations] = useState((wc?.frequentSituations || []).join(', '));
  const [phrases, setPhrases] = useState((wc?.workPhrases || []).join('\n'));
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const workContext: WorkContext = {
      profession,
      tools: splitList(tools),
      tasks: splitList(tasks),
      equipment: splitList(equipment),
      colleagues: splitList(colleagues),
      frequentSituations: splitList(situations),
      workPhrases: phrases.split('\n').map((s) => s.trim()).filter(Boolean),
    };
    await updateProfile({ profession, workContext });
    setSaved(true);
  };

  return (
    <>
      <Layout title="💼 Meu Trabalho" showMenu>
        <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">
          <p className="text-sm text-text-muted">O professor usa este vocabulário nas conversas.</p>
          {[
            ['Profissão', profession, setProfession, 'engenheiro, enfermeiro...'],
            ['Ferramentas', tools, setTools, 'separadas por vírgula'],
            ['Tarefas', tasks, setTasks, 'separadas por vírgula'],
            ['Equipamentos', equipment, setEquipment, 'separadas por vírgula'],
            ['Colegas', colleagues, setColleagues, 'separados por vírgula'],
            ['Situações frequentes', situations, setSituations, 'reunião, cliente, oficina...'],
          ].map(([label, value, setter, ph]) => (
            <label key={label as string} className="block">
              <span className="text-sm text-text-muted">{label as string}</span>
              <input
                value={value as string}
                onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                placeholder={ph as string}
                className="w-full mt-1 p-3 rounded-xl bg-surface border border-surface-light focus:border-primary focus:outline-none"
              />
            </label>
          ))}
          <label className="block">
            <span className="text-sm text-text-muted">Frases do trabalho (uma por linha)</span>
            <textarea
              value={phrases}
              onChange={(e) => setPhrases(e.target.value)}
              rows={4}
              className="w-full mt-1 p-3 rounded-xl bg-surface border border-surface-light focus:border-primary focus:outline-none"
            />
          </label>
          <button onClick={save} className="w-full py-3 rounded-2xl bg-primary font-bold">
            {saved ? 'Salvo' : 'Salvar contexto'}
          </button>
        </div>
      </Layout>
      <BottomNav />
    </>
  );
}
