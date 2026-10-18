"""External answer and human-rating imports; no answer generation or automatic entailment."""
import math
import re
import common as c
import packets


class BoundRecords(dict):
    """Records and the SHA of the same immutable bytes parsed to obtain them."""
    def __init__(self, raw, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.bundle_sha256 = c.sha(raw)


def experiment(root, expected):
    manifest, files = c.checked_snapshot(root, expected)
    plan = c.parse(files['private/plan.json']); packets.validate_plan(plan)
    c.require(c.sha(files['private/assignment-seed.txt']) == manifest['identity']['assignment_seed_sha256'], 'private assignment seed mismatch')
    c.require(c.sha(c.enc(manifest['identity'])) == manifest['experiment_id'], 'experiment identity does not bind configuration')
    c.require(c.sha(files['private/plan.json']) == manifest['identity']['plan_sha256'] and c.sha(files['private/archive.zip']) == manifest['identity']['archive_sha256'], 'experiment plan/archive identity mismatch')
    c.require(c.sha(c.enc(c.parse(files['private/rubric.json']))) == manifest['identity']['rubric_sha256'], 'frozen rubric mismatch')
    c.require(c.parse(files['private/rubric.json']) == c.RUBRIC, 'unsupported rubric version')
    catalog = packets.archive_data(files['private/archive.zip'])
    c.require(catalog == c.parse(files['private/catalog.json']), 'frozen source catalog mismatch')
    key = c.parse(files['private/arm-key.json']); by_id = {}
    questions = {q['id']:q for q in plan['questions'] if q['split']==plan['split']}
    for row in key:
        pid = row['packet_id']
        c.require(pid not in by_id and row['question_id'] in questions and row['arm'] in ('baseline','capsule'), 'invalid frozen arm key')
        public = c.parse(files['blind/packets/'+pid+'.json'])
        c.require(all(row[k] == v for k,v in public.items()) and row['experiment_id']==manifest['experiment_id'], 'packet binding mismatch')
        if row['status'] == 'ready':
            prompt = files['blind/prompts/'+pid+'.txt']; evidence = files['private/evidence/'+pid+'.json']
            prefix,suffix = packets.prompt_parts(plan,questions[row['question_id']]['text'])
            c.require(prompt == prefix+evidence+suffix and c.sha(prompt)==row['prompt_sha256'] and len(prompt)==row['prompt_bytes']<=plan['max_prompt_bytes']
                      and len(evidence)==row['evidence_bytes']<=row['evidence_max_bytes'], 'prompt byte identity/budget mismatch')
        else:
            c.require(row['status']=='retrieval_refused' and row['prompt_sha256'] is None, 'invalid frozen retrieval status')
        by_id[pid] = row
    c.require(len(by_id)==2*len(questions) and all(sorted(r['arm'] for r in key if r['question_id']==qid)==['baseline','capsule'] for qid in questions), 'incomplete paired assignments')
    return manifest,plan,catalog,by_id,files


def answer_template(args):
    manifest,plan,_,key,_ = experiment(args.experiment,args.experiment_sha256)
    rows=[]
    for packet in key.values():
        if packet['status']=='ready':
            rows.append({'packet_id':packet['packet_id'],'question_id':packet['question_id'],'prompt_sha256':packet['prompt_sha256'],
                         'model':plan['model'],'origin':plan['response_origin'],'status':'missing','answer':None,'citations':[],
                         'reason':'Not run; replace with externally produced output or explicit refusal/error.',
                         'measurements':{'origin':'unknown','provenance':None,'latency_ms':None,'input_tokens':None,'output_tokens':None,'cost':None}})
    value={'format':'tacitus-offline-answers/1','experiment_id':manifest['experiment_id'],'experiment_manifest_sha256':args.experiment_sha256,'submissions':rows}
    with c.fresh_directory(args.output) as out:
        c.write_json(out,'answers.json',value)
    return {'expected_ready_packets':len(rows),'warning':'Template contains missing answers, never successful model runs.'}


def measurements(value):
    c.fields(value, {'origin','provenance','latency_ms','input_tokens','output_tokens','cost'}, 'measurements')
    supplied = any(value[k] is not None for k in ('latency_ms','input_tokens','output_tokens','cost'))
    if supplied:
        c.require(value['origin']=='user_supplied_measured', 'measured values need explicit user-supplied provenance')
        c.text(value['provenance'],'measurement provenance',2000)
    else:
        c.require(value['origin']=='unknown' and value['provenance'] is None, 'unknown measurements must stay unknown')
    latency=value['latency_ms']
    c.require(latency is None or type(latency) in (int,float) and math.isfinite(latency) and 0<=latency<=10**12, 'invalid measured latency')
    for name in ('input_tokens','output_tokens'):
        if value[name] is not None:
            c.integer(value[name],0 if name=='output_tokens' else 1,10**9,name)
    if value['cost'] is not None:
        cost=value['cost'];c.fields(cost,{'amount','currency'},'measured cost')
        c.require(type(cost['amount']) in (int,float) and math.isfinite(cost['amount']) and 0<=cost['amount']<=10**9,'invalid measured cost')
        c.require(isinstance(cost['currency'],str) and re.fullmatch('[A-Z]{3}',cost['currency']),'invalid cost currency')


def citation_checks(citations, catalog, packet):
    c.require(isinstance(citations,list) and len(citations)<=128,'citation count bound exceeded')
    checks=[]
    for citation in citations:
        c.fields(citation,{'source','text_hash','start','end','quote'},'answer citation')
        errors=[]
        try:
            c.text(citation['quote'],'citation quote',65536)
            actual=packets.source_span(citation,catalog['sources'])
            if actual!=citation['quote']:
                errors.append('quote_bytes_mismatch')
            intervals=sorted((s['start'],s['end']) for s in packet['citation_spans'] if s['source']==citation['source'] and s['text_hash']==citation['text_hash'])
            cursor=citation['start']
            for start,end in intervals:
                if start<=cursor<end:
                    cursor=end
            present=cursor>=citation['end']
            if not present:
                errors.append('span_not_supplied_in_this_prompt')
        except (ValueError,TypeError,KeyError,UnicodeError) as error:
            errors.append('invalid_source_hash_or_utf8_span')
        checks.append({'citation':citation,'mechanical_errors':errors,'mechanically_valid':not errors})
    return {'status':('not_applicable_no_citations' if not checks else 'pass' if all(x['mechanically_valid'] for x in checks) else 'fail'),
            'checks':checks,'semantic_support':'not_scored; requires explicit human review'}


def answers(path, expected, manifest, plan, catalog, key):
    raw=c.read(path,4*1024*1024)
    value=c.parse(raw)
    c.fields(value,{'format','experiment_id','experiment_manifest_sha256','submissions'},'answer bundle')
    c.require(value['format']=='tacitus-offline-answers/1' and value['experiment_id']==manifest['experiment_id'] and value['experiment_manifest_sha256']==expected,'answer experiment identity mismatch')
    c.require(isinstance(value['submissions'],list) and len(value['submissions'])<=32,'answer count bound exceeded')
    result=BoundRecords(raw)
    for row in value['submissions']:
        c.fields(row,{'packet_id','question_id','prompt_sha256','model','origin','status','answer','citations','reason','measurements'},'answer')
        pid=row['packet_id']
        c.require(isinstance(pid,str) and pid in key and pid not in result,'unknown or duplicate answer packet')
        packet=key[pid]
        c.require(packet['status']=='ready','answer supplied for refused retrieval')
        c.require(row['question_id']==packet['question_id'] and row['prompt_sha256']==packet['prompt_sha256'],'answer question/prompt identity mismatch')
        c.require(c.enc(row['model'])==c.enc(plan['model']) and row['origin']==plan['response_origin'],'answer model/version/settings/tokenizer/origin mismatch')
        c.require(row['status'] in ('answered','refused','error','missing'),'invalid answer status')
        measurements(row['measurements'])
        if row['status']=='answered':
            c.text(row['answer'],'external answer',65536)
            c.require(row['reason'] is None,'answered record must not have refusal reason')
        else:
            c.require(row['answer'] is None and row['citations']==[],'missing/refused/error run cannot contain an answer or citations')
            c.text(row['reason'],'missing/refusal/error reason',2000)
        check=citation_checks(row['citations'],catalog,packet)
        measured=row['measurements']; violations=[];unknown=[]
        for field,limit in [('input_tokens',plan['model']['max_input_tokens']),('output_tokens',plan['model']['max_output_tokens'])]:
            if limit is not None:
                if measured[field] is None:
                    unknown.append(field)
                elif measured[field]>limit:
                    violations.append(field+'_ceiling_exceeded')
        result[pid]={'record':row,'answer_sha256':c.sha(c.enc(row)),'mechanical_citations':check,
                     'generation_budget':{'violations':violations,'unverified':unknown,
                                          'input_token_ceiling':plan['model']['max_input_tokens'],
                                          'note':'User-supplied counts only; no tokenizer/provider invoked. Byte matching does not establish token matching.'}}
    return result


def review_bundle(args):
    manifest,plan,catalog,key,_=experiment(args.experiment,args.experiment_sha256)
    imported=answers(args.answers,args.experiment_sha256,manifest,plan,catalog,key)
    question_map={q['id']:q['text'] for q in plan['questions']}
    blind=[]
    for pid,packet in key.items():
        item=imported.get(pid); record=item['record'] if item else None
        blind.append({'packet_id':pid,'question_id':packet['question_id'],'question':question_map[packet['question_id']],
                      'status':record['status'] if record else packet['status'] if packet['status']!='ready' else 'missing',
                      'answer_sha256':item['answer_sha256'] if item else None,'answer':record['answer'] if record else None,
                      'reason':record['reason'] if record else 'No externally supplied answer.'})
    # Deliberately omit key, model, prompts, retrieval receipts and machine checks from the human-review bundle.
    with c.fresh_directory(args.output) as out:
        c.write_json(out,'blind-answers.json',{'experiment_id':manifest['experiment_id'],'answers':blind,
                     'warning':'Arm key and machine checks withheld here; formats/content can still unblind. Declare actual review conditions.'})
        c.write_json(out,'sources.json',catalog['sources'])
        c.write_json(out,'rubric.json',c.RUBRIC)
        c.write_json(out,'ratings.json',{'format':'tacitus-offline-human-ratings/1','experiment_id':manifest['experiment_id'],
                     'experiment_manifest_sha256':args.experiment_sha256,'rubric_sha256':manifest['identity']['rubric_sha256'],'ratings':[]})
    return {'received_answers':len(imported),'expected_packets':len(key),'semantic_scores':'none; human ratings required'}


def ratings(path, expected, manifest, catalog, key, imported):
    raw=c.read(path,4*1024*1024)
    value=c.parse(raw)
    c.fields(value,{'format','experiment_id','experiment_manifest_sha256','rubric_sha256','ratings'},'rating bundle')
    c.require(value['format']=='tacitus-offline-human-ratings/1' and value['experiment_id']==manifest['experiment_id'] and value['experiment_manifest_sha256']==expected
              and value['rubric_sha256']==manifest['identity']['rubric_sha256'],'rating experiment/rubric mismatch')
    c.require(isinstance(value['ratings'],list) and len(value['ratings'])<=512,'rating count bound exceeded')
    result=BoundRecords(raw,{pid:{} for pid in key})
    for row in value['ratings']:
        c.fields(row,{'packet_id','answer_sha256','reviewer','scores','critical_failure','notes','source_refs','review_conditions'},'human rating')
        pid=row['packet_id']; reviewer=c.text(row['reviewer'],'reviewer',200)
        c.require(isinstance(pid,str) and pid in imported and reviewer not in result[pid],'unknown answer or duplicate reviewer rating')
        c.require(row['answer_sha256']==imported[pid]['answer_sha256'],'rating answer hash mismatch')
        c.require(imported[pid]['record']['status'] in ('answered','refused'),'human rating requires an answered or explicitly refused model run')
        c.fields(row['scores'],c.DIMENSIONS,'human scores')
        for score in row['scores'].values():
            c.integer(score,0,4,'human score')
        c.require(type(row['critical_failure']) is bool,'explicit human critical-failure flag required')
        c.text(row['notes'],'human notes',4000)
        c.require(isinstance(row['source_refs'],list) and len(row['source_refs'])<=32 and all(isinstance(s,str) and s in catalog['sources'] for s in row['source_refs'])
                  and len(set(row['source_refs']))==len(row['source_refs']),'unknown/duplicate human evidence reference')
        conditions=row['review_conditions']
        c.fields(conditions,{'arm_key_seen','mechanical_checks_seen','prior_case_exposure'},'review conditions')
        c.require(type(conditions['arm_key_seen']) is bool and type(conditions['mechanical_checks_seen']) is bool,'explicit review blinding disclosure required')
        c.text(conditions['prior_case_exposure'],'reviewer prior exposure',2000)
        result[pid][reviewer]=row
    return result


def summarize(args):
    manifest,plan,catalog,key,_=experiment(args.experiment,args.experiment_sha256)
    imported=answers(args.answers,args.experiment_sha256,manifest,plan,catalog,key)
    human=ratings(args.ratings,args.experiment_sha256,manifest,catalog,key,imported)
    rows=[]; deltas={d:[] for d in c.DIMENSIONS}; counts={s:0 for s in ('answered','refused','error','missing','retrieval_refused')}
    for qid in manifest['questions']:
        pair={}; by_arm={}
        for pid,packet in key.items():
            if packet['question_id']!=qid:
                continue
            item=imported.get(pid); status=item['record']['status'] if item else 'retrieval_refused' if packet['status']=='retrieval_refused' else 'missing'
            counts[status]+=1
            row={'packet_id':pid,'status':status,'reason':item['record']['reason'] if item else packet['retrieval_receipt'].get('reason','No externally supplied answer.'),'prompt_bytes':packet['prompt_bytes'],'retrieval_receipt':packet['retrieval_receipt'],
                 'answer_sha256':item['answer_sha256'] if item else None,'mechanical_citations':item['mechanical_citations'] if item else None,
                 'generation_budget':item['generation_budget'] if item else None,'measurements':item['record']['measurements'] if item else None,
                 'human_ratings':list(human[pid].values()),'human_status':'rated' if human[pid] else 'missing'}
            pair[packet['arm']]=row;by_arm[packet['arm']]=pid
        a,b=pair['baseline'],pair['capsule']
        matched=sorted(set(human[by_arm['baseline']])&set(human[by_arm['capsule']]))
        eligible=a['status'] in ('answered','refused') and b['status'] in ('answered','refused') and matched and not a['generation_budget']['violations'] and not b['generation_budget']['violations']
        differences=None
        if eligible:
            differences={d:sum(human[by_arm['capsule']][r]['scores'][d]-human[by_arm['baseline']][r]['scores'][d] for r in matched)/len(matched) for d in c.DIMENSIONS}
            for d,v in differences.items():
                deltas[d].append(v)
        question=next(q for q in plan['questions'] if q['id']==qid)
        rows.append({'question_id':qid,'question':question['text'],'question_kind':question['kind'],'arms':pair,'matched_reviewers':matched,'paired_human_comparison_eligible':bool(eligible),
                     'capsule_minus_baseline_human_scores':differences,
                     'regression_dimensions':[d for d,v in (differences or {}).items() if v<0],
                     'critical_failures':{arm:sum(r['critical_failure'] for r in value['human_ratings']) for arm,value in pair.items()}})
    aggregate={d:{'paired_questions':len(values),'mean_paired_delta':sum(values)/len(values) if values else None,
                  'regressions':sum(v<0 for v in values),'higher_scores':sum(v>0 for v in values),'ties':sum(v==0 for v in values)} for d,values in deltas.items()}
    report={'format':'tacitus-offline-evaluation-report/1','experiment_id':manifest['experiment_id'],'experiment_manifest_sha256':args.experiment_sha256,
            'report_processing_implementation':c.implementation(),'report_python_version':__import__('sys').version,
            'freeze_implementation':manifest['identity']['implementation'],
            'answer_bundle_sha256':imported.bundle_sha256,'rating_bundle_sha256':human.bundle_sha256,
            'response_origin_declaration':plan['response_origin'],'origin_authenticated':False,'model_declaration':plan['model'],
            'split':plan['split'],'source_split':plan['source_split'],'total_frozen_questions':len(rows),'run_status_counts':counts,
            'questions':rows,'descriptive_paired_human_results':aggregate,
            'limits':['Synthetic fixtures validate harness mechanics only; never actual model-quality results.' if plan['response_origin']=='synthetic_test_fixture' else 'External answers and measurements are user-supplied declarations, not provider-authenticated results.',
                      'Every frozen question retained. Missing answers/ratings/refused retrievals are not successes and receive no imputed semantic score.',
                      'Ordinal score means are descriptive summaries, not statistical effects. Paired descriptive deltas require both answered or explicitly refused model runs (abstentions), the same human reviewer on both arms, and no known measured token-ceiling violation. Excluded pairs remain visible.',
                      'Human ratings are subjective and unverified; individual judgments and disagreement are preserved. No automatic entailment or hallucination score exists.',
                      'Randomized labels/order are only partial blinding. Reported reviewer arm-key/machine-check exposure may compromise blinding.',
                      'Equal byte ceilings are not equal token budgets. Unknown latency/token/cost stays unknown; no inferred performance, cost or matched-token claim.',
                      'Baseline unselected candidate units include redundant closures; they are not comparable to native omitted assertion counts.',
                      'One frozen source subset and small/development samples support no source/domain generalization, statistical superiority or production-readiness claim. No model-quality gain established.']}
    with c.fresh_directory(args.output) as out:
        c.write_json(out,'report.json',report)
    return {'questions':len(rows),'run_status_counts':counts,'paired_human_questions':aggregate['support']['paired_questions'],
            'response_origin_declaration':plan['response_origin'],'report':'report.json'}
