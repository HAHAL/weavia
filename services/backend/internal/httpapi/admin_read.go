package httpapi

import "net/http"

func (s *Server) adminOverview(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminOverview(r.Context())
	respond(w, data, err)
}

func (s *Server) adminOrders(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminOrders(r.Context())
	respond(w, data, err)
}

func (s *Server) adminPlans(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminPlans(r.Context())
	respond(w, data, err)
}

func (s *Server) adminPayments(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminPayments(r.Context())
	respond(w, data, err)
}

func (s *Server) adminDevices(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminDevices(r.Context())
	respond(w, data, err)
}

func (s *Server) adminTaskRuns(w http.ResponseWriter, r *http.Request) {
	data, err := s.Commercial.AdminTaskRuns(r.Context())
	respond(w, data, err)
}
