import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TelegramService {
  private readonly base = '/api/telegram';

  constructor(private http: HttpClient) {}

  estado(): Observable<{ vinculado: boolean }> {
    return this.http.get<{ vinculado: boolean }>(`${this.base}/estado`);
  }

  vincular(): Observable<{ link: string; code: string }> {
    return this.http.post<{ link: string; code: string }>(`${this.base}/vincular`, {});
  }

  desvincular(): Observable<void> {
    return this.http.delete<void>(`${this.base}/vincular`);
  }
}
