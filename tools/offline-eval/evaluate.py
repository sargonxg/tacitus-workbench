#!/usr/bin/env python3
"""Local-only matched evaluation. Never calls providers or produces model answers."""
import argparse
import signal
import sys
import subprocess
import zipfile
import common as c
import packets
import results


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    sub=parser.add_subparsers(dest='command',required=True)
    freeze=sub.add_parser('freeze',help='Freeze verified source capsule and randomized matched prompts')
    for name in ('archive','archive-sha256','plan','core','core-sha256','output'):
        freeze.add_argument('--'+name,required=True)
    for command in ('answer-template','review','summarize'):
        p=sub.add_parser(command)
        for name in ('experiment','experiment-sha256','output'):
            p.add_argument('--'+name,required=True)
        if command in ('review','summarize'):
            p.add_argument('--answers',required=True)
        if command=='summarize':
            p.add_argument('--ratings',required=True)
    args=parser.parse_args()
    def cancel(signum, frame):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,cancel)
    try:
        action={'freeze':packets.freeze,'answer-template':results.answer_template,'review':results.review_bundle,'summarize':results.summarize}[args.command]
        print(c.enc(action(args)).decode())
        return 0
    except (ValueError,OSError,KeyError,TypeError,UnicodeError,KeyboardInterrupt,zipfile.BadZipFile,RuntimeError,subprocess.TimeoutExpired) as error:
        message='cancelled' if isinstance(error,KeyboardInterrupt) else str(error)[:1000]
        print(c.enc({'format':'tacitus-offline-eval-error/1','error':message}).decode(),file=sys.stderr)
        return 1


if __name__=='__main__':
    sys.exit(main())
