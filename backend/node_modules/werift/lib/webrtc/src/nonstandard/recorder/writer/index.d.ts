import { MediaStreamTrack } from "../../..";
import { MediaRecorderOptions } from "..";
export declare abstract class MediaWriter {
    protected path: string;
    protected options: Partial<MediaRecorderOptions>;
    constructor(path: string, options: Partial<MediaRecorderOptions>);
    start(tracks: MediaStreamTrack[]): Promise<void>;
    stop(): Promise<void>;
}
