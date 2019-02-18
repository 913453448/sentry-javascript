import { addGlobalEventProcessor, getCurrentHub } from '@sentry/hub';
import { Event, Integration, StackFrame } from '@sentry/types';
import { basename, relative } from '@sentry/utils/path';

type StackFrameIteratee = (frame: StackFrame) => StackFrame;

/** Rewrite event frames paths */
export class RewriteFrames implements Integration {
  /**
   * @inheritDoc
   */
  public name: string = RewriteFrames.id;

  /**
   * @inheritDoc
   */
  public static id: string = 'RewriteFrames';

  /**
   * @inheritDoc
   */
  private readonly root?: string;

  /**
   * @inheritDoc
   */
  private readonly iteratee: StackFrameIteratee = (frame: StackFrame) => {
    if (frame.filename && frame.filename.startsWith('/')) {
      const base = this.root ? relative(this.root, frame.filename) : basename(frame.filename);
      frame.filename = `app:///${base}`;
    }
    return frame;
  };

  /**
   * @inheritDoc
   */
  public constructor(options: { root?: string; iteratee?: StackFrameIteratee } = {}) {
    if (options.root) {
      this.root = options.root;
    }
    if (options.iteratee) {
      this.iteratee = options.iteratee;
    }
  }

  /**
   * @inheritDoc
   */
  public setupOnce(): void {
    addGlobalEventProcessor(event => {
      const self = getCurrentHub().getIntegration(RewriteFrames);
      if (self) {
        return self.process(event);
      }
      return event;
    });
  }

  /** JSDoc */
  public process(event: Event): Event {
    const frames = this.getFramesFromEvent(event);
    if (frames) {
      for (const i in frames) {
        // tslint:disable-next-line
        frames[i] = this.iteratee(frames[i]);
      }
    }
    return event;
  }

  /** JSDoc */
  private getFramesFromEvent(event: Event): StackFrame[] | undefined {
    const exception = event.exception;

    if (exception) {
      try {
        // tslint:disable-next-line:no-unsafe-any
        return (exception as any).values[0].stacktrace.frames;
      } catch (_oO) {
        return undefined;
      }
    } else if (event.stacktrace) {
      return event.stacktrace.frames;
    } else {
      return undefined;
    }
  }
}
