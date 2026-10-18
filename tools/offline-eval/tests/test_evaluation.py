"""Synthetic answers/ratings only. Native retrieval is real when CORE is configured."""
import argparse
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest
import zipfile
from unittest import mock

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import common as c
import packets
import results
REPO=HERE.parents[1]
ARCHIVE=REPO/'examples/july-1914/july-1914.native-v2.zip'
CORE=os.environ.get('TACITUS_KNOWLEDGE_CAPTURE_BIN')


def plan():
    p=c.load(HERE/'example-plan.json')
    p['response_origin']='synthetic_test_fixture'
    p['model'].update(name='SYNTHETIC TEST; NO MODEL',version='fixture/1',tokenizer_id='not-invoked',tokenizer_version='fixture/1')
    p['questions']=p['questions'][:1]+[dict(id='excluded',group='excluded',split='held_out',text='NEVER_EXPORT_EXCLUDED_QUESTION',kind='unknown',previously_exposed=False)]
    return p


class ProtocolTests(unittest.TestCase):
    def test_split_gold_model_schema_bounds(self):
        p=plan();self.assertEqual(len(packets.validate_plan(p)),1)
        for mutate in [lambda p:p.update(gold='SECRET GOLD'),lambda p:p['questions'][0].update(gold='SECRET'),
                       lambda p:p['questions'][1].update(group=p['questions'][0]['group']),
                       lambda p:p['questions'][1].update(text=p['questions'][0]['text'].upper()),
                       lambda p:p['questions'][1].update(previously_exposed=True),
                       lambda p:p['questions'][1].update(id=p['questions'][0]['id']),
                       lambda p:p['model'].update(max_output_tokens=True),
                       lambda p:p.update(max_prompt_bytes=4095),lambda p:p['model'].update(temperature=float('nan'))]:
            bad=copy.deepcopy(p);mutate(bad)
            with self.assertRaises((ValueError,TypeError)):
                packets.validate_plan(bad)
    def test_duplicate_json_and_private_atomic_cancel(self):
        with self.assertRaises(ValueError):c.parse(b'{"x":1,"x":2}')
        with self.assertRaises(ValueError):c.parse(b'{"x":NaN}')
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'out'
            with self.assertRaises(KeyboardInterrupt):
                with c.fresh_directory(out) as root:
                    c.write_json(root,'private/unfinished.json',{'secret':'test-only'});raise KeyboardInterrupt
            self.assertFalse(out.exists());self.assertEqual(list(Path(temp).iterdir()),[])
    def test_archive_bounds_hashes_duplicate_and_unsupported_clock(self):
        raw=ARCHIVE.read_bytes();catalog=packets.archive_data(raw)
        self.assertEqual(len(catalog['sources']),28)
        with zipfile.ZipFile(io.BytesIO(raw)) as z:files={n:z.read(n) for n in z.namelist()}
        def archive(members):
            buf=io.BytesIO()
            with zipfile.ZipFile(buf,'w') as z:
                for n,b in members:z.writestr(n,b)
            return buf.getvalue()
        with self.assertRaises(ValueError):packets.archive_data(archive(list(files.items())+[('capsule.json',files['capsule.json'])]))
        changed=dict(files);m=c.parse(changed['manifest.json']);m['valid_until']=1;changed['manifest.json']=c.enc(m)
        with self.assertRaisesRegex(ValueError,'expiring'):packets.archive_data(archive(changed.items()))
        name=next(n for n in files if n.startswith('evidence/'));changed=dict(files);changed[name]+=b'tamper'
        with self.assertRaisesRegex(ValueError,'hash mismatch'):packets.archive_data(archive(changed.items()))
    def test_measured_values_not_inferred_or_nonfinite(self):
        unknown={'origin':'unknown','provenance':None,'latency_ms':None,'input_tokens':None,'output_tokens':None,'cost':None}
        results.measurements(unknown)
        for change in [dict(latency_ms=1),dict(input_tokens=True),dict(origin='user_supplied_measured',provenance='test',latency_ms=float('inf')),
                       dict(origin='user_supplied_measured',provenance='test',cost={'amount':float('nan'),'currency':'USD'})]:
            with self.assertRaises(ValueError):results.measurements(dict(unknown,**change))


    def test_supplied_interval_union_utf8_gaps_and_no_automatic_semantics(self):
        raw='a'*2047+'🧭'+'b'*100
        sid='source@1';source={'metadata':{'text_hash':c.sha(raw.encode())},'text':raw}
        catalog={'sources':{sid:source}}
        def span(start,end):return dict(source=sid,text_hash=source['metadata']['text_hash'],start=start,end=end)
        citation=dict(span(2046,2052),quote=raw.encode()[2046:2052].decode())
        packet={'citation_spans':[span(0,2047),span(2047,len(raw.encode()))]}
        check=results.citation_checks([citation],catalog,packet);self.assertEqual(check['status'],'pass');self.assertIn('requires explicit human',check['semantic_support'])
        packet['citation_spans'][1]['start']=2051
        self.assertEqual(results.citation_checks([citation],catalog,packet)['status'],'fail')
        citation.update(start=2048,end=2051,quote='invalid UTF8 boundary')
        self.assertEqual(results.citation_checks([citation],catalog,packet)['status'],'fail')
    def test_baseline_content_only_unique_annotations_unknown_author_and_resource_bound(self):
        catalog=packets.archive_data(ARCHIVE.read_bytes())
        next(iter(catalog['sources'].values()))['metadata']['author']=None
        pool=packets.units(catalog)
        raw,_,receipt=packets.baseline(catalog,pool,'text_hash',250000,'disclose_unknown')
        selected=c.parse(raw)['evidence'];self.assertEqual(receipt['selected_units'],0)
        raw,_,receipt=packets.baseline(catalog,pool,'peace mediation',250000,'disclose_unknown')
        selected=c.parse(raw)['evidence'];self.assertGreater(len(selected['assertions']),0)
        self.assertEqual(len(selected['assertions']),len(set(selected['assertions'])))
        # Each map stores one complete assertion, regardless of overlapping node/link closures.
        for aid,a in selected['assertions'].items():self.assertEqual(a,catalog['assertions'][aid])
        with self.assertRaisesRegex(ValueError,'deadline'):packets.units(catalog,time.monotonic()-1)
        sid='bounded@1';text='x'*(2*1024*1024);h=c.sha(text.encode())
        span=dict(source=sid,text_hash=h,start=0,end=1100000)
        a=dict(id='a',evidence=[span],proposition='bounded synthetic',conditions=[],exceptions=[])
        b=dict(a,id='b')
        tiny=dict(sources={sid:dict(metadata=dict(text_hash=h,title='Bound test',author=None),text=text)},assertions={'a':a,'b':b},sidecar={'graph':{'nodes':{'n':{'id':'n','label':'bounded','claims':['a','b']}},'links':[]}})
        with self.assertRaisesRegex(ValueError,'closure byte bound'):packets.units(tiny)


@unittest.skipUnless(CORE,'real pinned native core required; set TACITUS_KNOWLEDGE_CAPTURE_BIN')
class MatchedNativeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory(prefix='tacitus-eval-tests-');cls.base=Path(cls.temp.name)
        cls.plan=plan();cls.planpath=cls.base/'plan.json';cls.planpath.write_bytes(c.enc(cls.plan))
        cls.root=cls.base/'experiment';cls.corehash=c.sha(c.read(CORE,64*1024*1024))
        cls.args=argparse.Namespace(plan=cls.planpath,archive=ARCHIVE,archive_sha256=c.sha(ARCHIVE.read_bytes()),core=CORE,core_sha256=cls.corehash,output=cls.root)
        cls.receipt=packets.freeze(cls.args)
        cls.expected=cls.receipt['manifest_sha256']
        cls.manifest,cls.p,cls.catalog,cls.key,cls.files=results.experiment(cls.root,cls.expected)
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def setUp(self):
        self.work=Path(tempfile.mkdtemp(dir=self.base))
    def bundle(self):
        submissions=[]
        for packet in self.key.values():
            if packet['status']!='ready':continue
            span=packet['citation_spans'][0];quote=packets.source_span(span,self.catalog['sources'])
            citation={k:span[k] for k in ('source','text_hash','start','end')};citation['quote']=quote
            submissions.append(dict(packet_id=packet['packet_id'],question_id=packet['question_id'],prompt_sha256=packet['prompt_sha256'],
                                    model=self.plan['model'],origin='synthetic_test_fixture',status='answered',
                                    answer='SYNTHETIC TEST ANSWER ONLY; never model output. '+quote,citations=[citation],reason=None,
                                    measurements={'origin':'unknown','provenance':None,'latency_ms':None,'input_tokens':None,'output_tokens':None,'cost':None}))
        return dict(format='tacitus-offline-answers/1',experiment_id=self.manifest['experiment_id'],experiment_manifest_sha256=self.expected,submissions=submissions)
    def save(self,name,value):
        path=self.work/name;path.write_bytes(c.enc(value));return path
    def imported(self,bundle):
        return results.answers(self.save('answers.json',bundle),self.expected,self.manifest,self.plan,self.catalog,self.key)
    def human(self,imported):
        ratings=[]
        for pid,item in imported.items():
            arm=self.key[pid]['arm'];scores={d:2 if arm=='baseline' else 1 for d in c.DIMENSIONS}
            ratings.append(dict(packet_id=pid,answer_sha256=item['answer_sha256'],reviewer='SYNTHETIC REVIEWER TEST ONLY',scores=scores,critical_failure=arm=='capsule',
                                notes='SYNTHETIC TEST RATING ONLY; no human study or quality measurement.',source_refs=[],
                                review_conditions=dict(arm_key_seen=False,mechanical_checks_seen=False,prior_case_exposure='Synthetic harness fixture')))
        return dict(format='tacitus-offline-human-ratings/1',experiment_id=self.manifest['experiment_id'],experiment_manifest_sha256=self.expected,
                    rubric_sha256=self.manifest['identity']['rubric_sha256'],ratings=ratings)
    def summary(self,bundle,human,name='report'):
        args=argparse.Namespace(experiment=self.root,experiment_sha256=self.expected,answers=self.save('answers.json',bundle),ratings=self.save('ratings.json',human),output=self.work/name)
        result=results.summarize(args);return result,c.load(self.work/name/'report.json')
    def test_fullsource_universe_annotations_budget_random_assignment_and_exact_native(self):
        self.assertEqual(self.receipt['source_count'],28);self.assertEqual(self.receipt['assertions'],39);self.assertEqual(self.receipt['ready'],2)
        pool=packets.units(self.catalog)
        source_blocks=[u for u in pool if u['id'].startswith('block:')]
        for sid,s in self.catalog['sources'].items():
            blocks=[u for u in source_blocks if u['spans'][0]['source']==sid]
            self.assertEqual(''.join(u['value']['text'] for u in blocks),s['text'])
        self.assertEqual(sum(u['id'].startswith('assertion:') for u in pool),39)
        self.assertTrue(any(u['id'].startswith('relationship:') for u in pool));self.assertTrue(any(u['id'].startswith('node:') for u in pool))
        self.assertEqual(sorted(p['label'] for p in self.key.values()),['A','B'])
        for pid,packet in self.key.items():
            prompt=self.files['blind/prompts/'+pid+'.txt'];self.assertLessEqual(len(prompt),self.plan['max_prompt_bytes'])
            self.assertNotIn(b'NEVER_EXPORT_EXCLUDED_QUESTION',prompt)
            self.assertNotIn(b'SYNTHETIC TEST ANSWER ONLY',prompt)
            if packet['arm']=='capsule':
                q=dict(self.plan['retrieval'],question=self.plan['questions'][0]['text'],max_bytes=packet['evidence_max_bytes'],revoked_sources=[])
                raw=c.safe.run([CORE,'reuse',ARCHIVE],c.enc(q),limit=250000)
                self.assertEqual(raw,self.files['private/evidence/'+pid+'.json'])
        # Repeating freeze creates a new identity/randomization, never overwrites a frozen trial.
        with self.assertRaises(ValueError):packets.freeze(self.args)
    def test_missing_refused_error_answers_are_not_success_or_zero_ratings(self):
        b=self.bundle();b['submissions']=[];human=self.human({})
        _,r=self.summary(b,human);self.assertEqual(r['run_status_counts']['missing'],2)
        self.assertEqual(r['descriptive_paired_human_results']['support']['paired_questions'],0)
        self.assertIsNone(r['descriptive_paired_human_results']['support']['mean_paired_delta'])
        for status in ('refused','error','missing'):
            b=self.bundle();b['submissions'][0].update(status=status,answer=None,citations=[],reason='Synthetic '+status)
            imported=self.imported(b);_,r=self.summary(b,self.human({pid:v for pid,v in imported.items() if v['record']['status']=='answered'}),status)
            self.assertEqual(r['run_status_counts'][status],1);self.assertFalse(r['questions'][0]['paired_human_comparison_eligible'])
    def test_human_regressions_disagreement_unblinding_and_unknown_metrics_preserved(self):
        b=self.bundle();i=self.imported(b);human=self.human(i)
        for rating in list(human['ratings']):
            other=copy.deepcopy(rating);other['reviewer']='SECOND SYNTHETIC REVIEWER';other['scores']={d:4 for d in c.DIMENSIONS};other['review_conditions']['arm_key_seen']=True;human['ratings'].append(other)
        _,r=self.summary(b,human)
        self.assertEqual(r['response_origin_declaration'],'synthetic_test_fixture');self.assertFalse(r['origin_authenticated'])
        self.assertEqual(r['descriptive_paired_human_results']['support']['mean_paired_delta'],-.5)
        self.assertEqual(r['questions'][0]['regression_dimensions'],list(c.DIMENSIONS))
        for arm in r['questions'][0]['arms'].values():
            self.assertEqual(len(arm['human_ratings']),2);self.assertEqual(arm['measurements']['origin'],'unknown')
            self.assertIsNone(arm['measurements']['input_tokens']);self.assertEqual(arm['mechanical_citations']['status'],'pass')
            self.assertIn('human',arm['mechanical_citations']['semantic_support'])
    def test_wrong_identity_model_duplicate_origin_ratings_and_known_token_overflow(self):
        base=self.bundle()
        for mutate in [lambda b:b.update(experiment_id='0'*64),lambda b:b['submissions'][0].update(prompt_sha256='0'*64),
                       lambda b:b['submissions'][0]['model'].update(version='OTHER'),lambda b:b['submissions'].append(copy.deepcopy(b['submissions'][0])),
                       lambda b:b['submissions'][0].update(origin='external_model_output')]:
            b=copy.deepcopy(base);mutate(b)
            with self.assertRaises(ValueError):self.imported(b)
        i=self.imported(self.bundle());h=self.human(i);h['ratings'][0]['answer_sha256']='0'*64
        with self.assertRaises(ValueError):self.summary(self.bundle(),h)
        b=self.bundle();b['submissions'][0]['measurements']=dict(origin='user_supplied_measured',provenance='Synthetic measurement fixture',latency_ms=10,input_tokens=200,output_tokens=1001,cost={'amount':0,'currency':'USD'})
        i=self.imported(b);_,r=self.summary(b,self.human(i),'overflow')
        self.assertFalse(r['questions'][0]['paired_human_comparison_eligible']);self.assertTrue(any(v['generation_budget']['violations'] for v in r['questions'][0]['arms'].values()))
    def test_bad_quotes_offsets_and_valid_but_unseen_citation_not_semantically_scored(self):
        b=self.bundle();b['submissions'][0]['citations'][0]['quote']+=' fabricated';i=self.imported(b)
        self.assertEqual(next(iter(i.values()))['mechanical_citations']['status'],'fail')
        b=self.bundle();row=b['submissions'][0];packet=self.key[row['packet_id']]
        # Find an exact canonical source byte span absent from this packet.
        for sid,s in self.catalog['sources'].items():
            for at,ch in enumerate(s['text']):
                start=len(s['text'][:at].encode());end=start+len(ch.encode())
                if ch.strip() and not any(x['source']==sid and x['start']<=start<end<=x['end'] for x in packet['citation_spans']):
                    row['citations']=[dict(source=sid,text_hash=s['metadata']['text_hash'],start=start,end=end,quote=ch)];break
            else:continue
            break
        else:self.fail('fixture requires non-retrieved canonical evidence')
        i=self.imported(b);check=i[row['packet_id']]['mechanical_citations'];self.assertEqual(check['status'],'fail');self.assertIn('span_not_supplied_in_this_prompt',check['checks'][0]['mechanical_errors'])
        row['citations'][0]['start']=True;i=self.imported(b);self.assertEqual(i[row['packet_id']]['mechanical_citations']['status'],'fail')
    def test_blind_review_keeps_arm_key_machine_checks_and_gold_notes_out_of_retrieval(self):
        b=self.bundle();path=self.save('answers.json',b);out=self.work/'review'
        results.review_bundle(argparse.Namespace(experiment=self.root,experiment_sha256=self.expected,answers=path,output=out))
        blind=c.load(out/'blind-answers.json');self.assertNotIn('arm',str(blind));self.assertNotIn('mechanical_citations',str(blind))
        h=self.human(self.imported(b));h['ratings'][0]['notes']='PRIVATE GOLD CHECKLIST ONLY — human review stage.'
        _,report=self.summary(b,h)
        self.assertIn('PRIVATE GOLD',str(report));self.assertFalse(any(b'PRIVATE GOLD' in raw for name,raw in self.files.items() if name.startswith('blind/')))
    def test_frozen_tamper_extra_symlink_bad_manifest_and_atomic_sigterm(self):
        import shutil
        target=self.work/'copy';shutil.copytree(self.root,target)
        p=target/'private/plan.json';p.write_bytes(p.read_bytes()+b' ')
        with self.assertRaises(ValueError):results.experiment(target,self.expected)
        p.write_bytes(self.files['private/plan.json']);(target/'extra.json').write_text('{}')
        with self.assertRaises(ValueError):results.experiment(target,self.expected)
        (target/'extra.json').unlink();p.unlink();p.symlink_to(self.root/'private/plan.json')
        with self.assertRaises(OSError):results.experiment(target,self.expected)
        with self.assertRaises(ValueError):results.experiment(self.root,'0'*64)
        slow=self.work/'slow-core';slow.write_text('#!/usr/bin/python3\nimport time\ntime.sleep(20)\n');slow.chmod(0o700)
        out=self.work/'cancelled';cmd=[sys.executable,str(HERE/'evaluate.py'),'freeze','--archive',str(ARCHIVE),'--archive-sha256',c.sha(ARCHIVE.read_bytes()),'--plan',str(self.planpath),'--core',str(slow),'--core-sha256',c.sha(slow.read_bytes()),'--output',str(out)]
        p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        try:
            end=time.monotonic()+5
            while not list(self.work.glob('.cancelled.stage-*')) and p.poll() is None and time.monotonic()<end:time.sleep(.01)
            self.assertIsNone(p.poll());p.send_signal(signal.SIGTERM);stdout,stderr=p.communicate(timeout=5)
            self.assertNotEqual(p.returncode,0);self.assertEqual(stdout,b'');self.assertFalse(out.exists());self.assertFalse(list(self.work.glob('.cancelled.stage-*')))
        finally:
            if p.poll() is None:p.kill();p.wait()
    def test_private_seed_replay_and_execution_errors_do_not_become_refusals(self):
        seed=self.files['private/assignment-seed.txt'].decode()
        self.assertNotIn(seed,c.enc(self.manifest).decode())
        self.assertEqual(c.sha(seed.encode()),self.manifest['identity']['assignment_seed_sha256'])
        actual=c.safe.run
        def crash(args,*a,**kw):
            if args[1]=='reuse':raise c.safe.ChildRefusal('core','subprocess_refused')
            return actual(args,*a,**kw)
        args=copy.copy(self.args);args.output=self.work/'crashed'
        with mock.patch.object(c.safe,'run',side_effect=crash):
            with self.assertRaisesRegex(ValueError,'not a recognized'):packets.freeze(args)
        self.assertFalse(args.output.exists());self.assertFalse(list(self.work.glob('.crashed.stage-*')))
    def test_rated_model_abstention_is_compared_and_bundle_hashes_bind_parsed_bytes(self):
        b=self.bundle();b['submissions'][0].update(status='refused',answer=None,citations=[],reason='Synthetic justified abstention test')
        imported=self.imported(b);h=self.human(imported)
        args=argparse.Namespace(experiment=self.root,experiment_sha256=self.expected,answers=self.save('answers.json',b),ratings=self.save('ratings.json',h),output=self.work/'bound-report')
        answer_sha=c.sha(args.answers.read_bytes());rating_sha=c.sha(args.ratings.read_bytes());actual=results.ratings
        def replace_after_read(*a,**kw):
            value=actual(*a,**kw);args.answers.write_bytes(b'{}');args.ratings.write_bytes(b'{}');return value
        with mock.patch.object(results,'ratings',side_effect=replace_after_read):results.summarize(args)
        report=c.load(args.output/'report.json')
        self.assertTrue(report['questions'][0]['paired_human_comparison_eligible'])
        self.assertEqual(report['answer_bundle_sha256'],answer_sha);self.assertEqual(report['rating_bundle_sha256'],rating_sha)
        self.assertTrue(any(v['reason']=='Synthetic justified abstention test' for v in report['questions'][0]['arms'].values()))
    def test_cli_templates_review_summary_with_missing_answers_and_no_gold_reader(self):
        def invoke(command,output,*extra):
            cmd=[sys.executable,str(HERE/'evaluate.py'),command,'--experiment',str(self.root),'--experiment-sha256',self.expected,'--output',str(output),*extra]
            r=subprocess.run(cmd,capture_output=True,timeout=10);self.assertEqual(r.returncode,0,r.stderr.decode());return c.parse(r.stdout)
        template=self.work/'template';invoke('answer-template',template)
        answerpath=template/'answers.json';self.assertTrue(all(r['status']=='missing' and r['answer'] is None for r in c.load(answerpath)['submissions']))
        review=self.work/'review-missing';invoke('review',review,'--answers',str(answerpath))
        result=invoke('summarize',self.work/'cli-report','--answers',str(answerpath),'--ratings',str(review/'ratings.json'))
        self.assertEqual(result['run_status_counts']['missing'],2);self.assertEqual(result['paired_human_questions'],0)
        self.assertFalse(any('gold' in p.name.lower() for p in self.root.rglob('*')))
        # Optional retained test artifact: all answers remain explicitly missing; no model study.
        destination=os.environ.get('TACITUS_EVAL_RETAIN_TEST_ARTIFACT')
        if destination:
            with c.fresh_directory(destination) as stage:
                for prefix,folder in [('experiment',self.root),('answer-template',template),('blind-review',review),('report',self.work/'cli-report')]:
                    for p in folder.rglob('*'):
                        if p.is_file():c.write(stage,prefix+'/'+p.relative_to(folder).as_posix(),p.read_bytes())
                c.write_json(stage,'test-receipt.json',dict(experiment_id=self.manifest['experiment_id'],manifest_sha256=self.expected,response_origin='synthetic_test_fixture',answers_collected=0,paired_human_questions=0))


    def test_cli_bad_zip_versioned_error_and_deadline_before_publication(self):
        bad=self.work/'bad.zip';bad.write_bytes(b'not a ZIP')
        cmd=[sys.executable,str(HERE/'evaluate.py'),'freeze','--archive',str(bad),'--archive-sha256',c.sha(bad.read_bytes()),'--plan',str(self.planpath),'--core',CORE,'--core-sha256',self.corehash,'--output',str(self.work/'bad-output')]
        run=subprocess.run(cmd,capture_output=True,timeout=5);self.assertEqual(run.returncode,1);self.assertEqual(run.stdout,b'');self.assertEqual(c.parse(run.stderr)['format'],'tacitus-offline-eval-error/1')
        self.assertFalse((self.work/'bad-output').exists())
        original_run=c.safe.run;clock=time.monotonic;expired=False;timeouts=[]
        def simulated_clock():return clock()+(121 if expired else 0)
        def expire_after_query(args,*a,**kw):
            nonlocal expired
            timeouts.append(kw.get('timeout'));value=original_run(args,*a,**kw)
            if args[1]=='reuse':expired=True
            return value
        args=copy.copy(self.args);args.output=self.work/'late-output'
        with mock.patch.object(packets.time,'monotonic',side_effect=simulated_clock),mock.patch.object(c.safe,'run',side_effect=expire_after_query):
            with self.assertRaisesRegex(ValueError,'deadline'):packets.freeze(args)
        self.assertFalse(args.output.exists());self.assertTrue(all(t is not None and 0<t<=10 for t in timeouts))

    def test_strict_refused_retrieval_is_retained_and_has_no_answer_packet(self):
        p=copy.deepcopy(self.plan);p['retrieval']['time_mode']='require_declared_interval';path=self.save('strict.json',p);out=self.work/'strict'
        args=copy.copy(self.args);args.plan=path;args.output=out
        receipt=packets.freeze(args);self.assertEqual(receipt['ready'],0)
        m,plan,catalog,key,_=results.experiment(out,receipt['manifest_sha256'])
        self.assertTrue(all(r['status']=='retrieval_refused' for r in key.values()))
        answer=dict(format='tacitus-offline-answers/1',experiment_id=m['experiment_id'],experiment_manifest_sha256=receipt['manifest_sha256'],submissions=[])
        h=dict(format='tacitus-offline-human-ratings/1',experiment_id=m['experiment_id'],experiment_manifest_sha256=receipt['manifest_sha256'],rubric_sha256=m['identity']['rubric_sha256'],ratings=[])
        a=argparse.Namespace(experiment=out,experiment_sha256=receipt['manifest_sha256'],answers=self.save('strict-answers.json',answer),ratings=self.save('strict-ratings.json',h),output=self.work/'strict-report')
        r=results.summarize(a);self.assertEqual(r['run_status_counts']['retrieval_refused'],2);self.assertEqual(r['paired_human_questions'],0)


if __name__=='__main__':unittest.main(verbosity=2)
